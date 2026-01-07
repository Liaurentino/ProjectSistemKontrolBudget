import {
  getAccessToken,
  saveTokens,
  isTokenExpired,
  clearAccurateTokens,
  validateAccurateApiToken,
  getAccurateDatabaseList,
  type AccurateValidationResult,
  type AccurateDatabase,
} from './accurateMiddleware';
import { supabase } from './supabase';

const CLIENT_ID = import.meta.env.VITE_ACCURATE_CLIENT_ID!;
const REDIRECT_URI = import.meta.env.VITE_ACCURATE_REDIRECT_URI!;
const HMAC_SECRET_KEY = import.meta.env.VITE_ACCURATE_HMAC_SECRET || '';

// ============================================
// TYPES
// ============================================

export interface Category {
  accurate_id: string;
  name: string;
  code: string;
  description?: string;
}

export interface Account {
  id?: string;
  entity_id: string;  // ID database Accurate
  accurate_id: string;
  account_name: string;
  account_code: string;
  account_type: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GLAccount {
  id: number;
  number: string;
  name: string;
  accountType?: {
    id: number;
    name: string;
  };
  isActive?: boolean;
}

export interface GLAccountListResponse {
  s: boolean;
  d: GLAccount[];
  sp?: {
    pageCount: number;
    page: number;
  };
}

// NEW: Types for fetchCoaFromAccurate
export interface CoaAccount {
  id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  account_type_name: string;
  balance: number;
  currency: string;
  is_parent: boolean;
  suspended: boolean;
  parent_id: number | null;
}

export interface FetchCoaResult {
  success: boolean;
  accounts?: CoaAccount[];
  total?: number;
  pagination?: any;
  error?: string;
}

export type { AccurateValidationResult, AccurateDatabase };

// ============================================
// OAUTH FLOW
// ============================================

export const getAuthorizationUrl = () => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: 'read write',
  });

  return `https://account.accurate.id/oauth/authorize?${params.toString()}`;
};

export const exchangeCodeForToken = async (code: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('accurate-oauth', {
      body: {
        action: 'exchangeCode',
        code,
      },
    });

    if (error) throw error;

    if (data?.access_token && data?.refresh_token && data?.expires_in) {
      saveTokens(data.access_token, data.refresh_token, data.expires_in);
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    return { data: null, error };
  }
};

// ============================================
// NEW: FETCH COA (tanpa simpan ke DB)
// ============================================

/**
 * Fetch COA dari Accurate API via Edge Function (tanpa simpan ke DB)
 * Ini dipakai di CoaPage yang baru
 */
export async function fetchCoaFromAccurate(entityId: string, apiToken: string): Promise<FetchCoaResult> {
  try {
    console.log(`[fetchCoaFromAccurate] Starting...`);
    console.log(`[fetchCoaFromAccurate] Entity ID: ${entityId}`);
    console.log(`[fetchCoaFromAccurate] API Token length: ${apiToken?.length || 0}`);

    if (!apiToken) {
      console.error('[fetchCoaFromAccurate] No API token provided');
      return {
        success: false,
        error: 'API Token tidak ditemukan untuk entitas ini',
      };
    }

    // Get secret key from env (frontend)
    const secretKey = HMAC_SECRET_KEY;
    if (!secretKey) {
      console.error('[fetchCoaFromAccurate] No secret key in environment');
      return {
        success: false,
        error: 'Secret key tidak dikonfigurasi',
      };
    }

    console.log(`[fetchCoaFromAccurate] Calling Edge Function...`);
    console.log(`[fetchCoaFromAccurate] Secret key length: ${secretKey?.length}`);

    // Call Edge Function accurate-fetch-coa
    const { data, error } = await supabase.functions.invoke('accurate-fetch-coa', {
      body: {
        apiToken,
        secretKey,
        entityId,
      },
    });

    console.log('[fetchCoaFromAccurate] Edge Function responded');
    console.log('[fetchCoaFromAccurate] Has error:', !!error);
    console.log('[fetchCoaFromAccurate] Has data:', !!data);
    console.log('[fetchCoaFromAccurate] Full data:', data);
    console.log('[fetchCoaFromAccurate] Full error:', error);

    if (error) {
      console.error('[fetchCoaFromAccurate] Edge Function error:', error);
      console.error('[fetchCoaFromAccurate] Error type:', typeof error);
      console.error('[fetchCoaFromAccurate] Error details:', JSON.stringify(error, null, 2));
      
      // Try to get detailed error message from response
      let detailedError = error.message || 'Gagal memanggil Edge Function';
      if (data && data.error) {
        detailedError = data.error;
      }
      
      return {
        success: false,
        error: detailedError,
      };
    }

    console.log('[fetchCoaFromAccurate] Data:', data);

    if (!data || !data.success) {
      console.error('[fetchCoaFromAccurate] Fetch failed, data:', data);
      return {
        success: false,
        error: data?.error || 'Fetch gagal tanpa error message',
      };
    }

    console.log(`[fetchCoaFromAccurate] Successfully fetched ${data.total} accounts`);

    return {
      success: true,
      accounts: data.accounts,
      total: data.total,
      pagination: data.pagination,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[fetchCoaFromAccurate] Caught error:', error);
    console.error('[fetchCoaFromAccurate] Error stack:', error instanceof Error ? error.stack : 'N/A');

    return {
      success: false,
      error: errorMsg,
    };
  }
}

// ============================================
// SYNC COA VIA EDGE FUNCTION (per entity)
// Yang lama - untuk sync + simpan ke DB
// ============================================

export async function fetchAndSyncCOA(entityId: string): Promise<{
  success: boolean;
  synced: number;
  error?: string;
}> {
  try {
    console.log(`[Accurate] Starting COA sync for entity ${entityId}...`);

    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available. Please authenticate first.');
    }

    // Call Edge Function untuk bulk sync
    const { data, error } = await supabase.functions.invoke('accurate-sync-coa', {
      body: {
        accessToken,
        dbId: entityId,  // entityId = dbId dari Accurate
        pageSize: 100,
      },
    });

    if (error) {
      console.error('[Accurate] Edge Function error:', error);
      throw error;
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Sync failed');
    }

    console.log(`[Accurate] COA sync completed for entity ${entityId}: ${data.synced} accounts`);

    return {
      success: true,
      synced: data.synced,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Accurate] COA sync error:', error);

    return {
      success: false,
      synced: 0,
      error: errorMsg,
    };
  }
}

/**
 * Sync single account via webhook (sudah include entity_id)
 */
export async function syncSingleAccount(
  entityId: string,
  accountId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    // Open session
    const sessionResponse = await fetch('https://account.accurate.id/api/open-db.do', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `dbId=${entityId}`,
    });

    const sessionResult = await sessionResponse.json();
    if (!sessionResult.s) {
      throw new Error('Failed to open database session');
    }

    const { session: sessionId, host } = sessionResult.d;

    // Call webhook edge function
    const { data, error } = await supabase.functions.invoke('accurate-webhook-coa', {
      body: {
        event: 'glAccount.update',
        id: accountId,
        entityId,  // Pass entity ID
        host,
        sessionId,
        accessToken,
      },
    });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Accurate] Sync single account error:', error);
    return { success: false, error: errorMsg };
  }
}

// ============================================
// LOCAL DATABASE QUERIES (dengan entity filter)
// ============================================

/**
 * Get accounts untuk entity tertentu
 */
export const getLocalAccounts = async (entityId: string) => {
  const { data, error } = await supabase
    .from('accurate_accounts')
    .select('*')
    .eq('entity_id', entityId)
    .eq('is_active', true)
    .order('account_code', { ascending: true });

  return { data, error };
};

/**
 * Get accounts untuk multiple entities (untuk reporting)
 */
export const getLocalAccountsByEntities = async (entityIds: string[]) => {
  const { data, error } = await supabase
    .from('accurate_accounts')
    .select('*')
    .in('entity_id', entityIds)
    .eq('is_active', true)
    .order('entity_id', { ascending: true })
    .order('account_code', { ascending: true });

  return { data, error };
};

/**
 * Subscribe to account changes untuk entity tertentu
 */
export function subscribeAccounts(entityId: string, onChange: () => void) {
  return supabase
    .channel(`accounts_${entityId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'accurate_accounts',
        filter: `entity_id=eq.${entityId}`,
      },
      () => onChange()
    )
    .subscribe();
}

/**
 * Get sync history dengan entity filter
 */
export const getSyncHistory = async (entityId?: string, limit: number = 10) => {
  let query = supabase
    .from('accurate_sync_history')
    .select('*')
    .order('synced_at', { ascending: false })
    .limit(limit);

  if (entityId) {
    query = query.eq('entity_id', entityId);
  }

  const { data, error } = await query;
  return { data, error };
};

// ============================================
// SYNC CATEGORIES (jika perlu - per entity)
// ============================================

export const syncAccurateCategories = async (entityId: string, categories: Category[]) => {
  try {
    const { data, error } = await supabase
      .from('accurate_categories')
      .upsert(
        categories.map((cat) => ({
          entity_id: entityId,
          accurate_id: cat.accurate_id,
          name: cat.name,
          code: cat.code,
          description: cat.description,
          is_active: true,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'entity_id,accurate_id' }
      );

    if (error) throw error;

    await supabase.from('accurate_sync_history').insert({
      entity_id: entityId,
      sync_type: 'categories',
      status: 'success',
      records_synced: categories.length,
      synced_at: new Date().toISOString(),
    });

    return { data, error: null };
  } catch (error) {
    console.error('Error syncing categories:', error);

    try {
      await supabase.from('accurate_sync_history').insert({
        entity_id: entityId,
        sync_type: 'categories',
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        synced_at: new Date().toISOString(),
      });
    } catch (logError) {
      console.error('Error logging sync failure:', logError);
    }

    return { data: null, error };
  }
};

// ============================================
// DATABASE / ENTITAS OPERATIONS
// ============================================

export const validateEntitasToken = async (
  apiToken: string,
  secretKey: string = HMAC_SECRET_KEY
): Promise<AccurateValidationResult> => {
  return validateAccurateApiToken(apiToken, secretKey);
};

export const getEntitasList = async (
  apiToken: string,
  secretKey: string = HMAC_SECRET_KEY
) => {
  const result = await getAccurateDatabaseList(apiToken, secretKey);
  return {
    data: result.data,
    error: result.error,
    success: result.success,
  };
};

// ============================================
// BULK SYNC untuk multiple entities
// ============================================

export async function syncMultipleEntities(
  entityIds: string[]
): Promise<{
  results: { entityId: string; success: boolean; synced: number; error?: string }[];
  totalSynced: number;
}> {
  const results = [];
  let totalSynced = 0;

  for (const entityId of entityIds) {
    const result = await fetchAndSyncCOA(entityId);
    results.push({
      entityId,
      ...result,
    });
    if (result.success) {
      totalSynced += result.synced;
    }
  }

  return { results, totalSynced };
}