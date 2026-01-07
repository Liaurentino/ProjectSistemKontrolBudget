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
// SYNC COA VIA EDGE FUNCTION (per entity)
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
