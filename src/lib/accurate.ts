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
  entity_id: string;
  accurate_id: string;
  account_name: string;
  account_code: string;
  account_type: string;
  account_type_name?: string;
  balance?: number;
  currency?: string;
  suspended?: boolean;
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

// Types for fetchCoaFromAccurate (manual sync)
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
// FETCH COA - Manual Sync (Fallback/Initial Load)
// ============================================

/**
 * Fetch COA dari Accurate API via Edge Function (tanpa simpan ke DB)
 * 
 * USE CASE:
 * - Initial load (first time setup)
 * - Force refresh (kalau webhook gagal)
 * - Bulk sync on-demand
 * 
 * NOTE: Untuk real-time updates, gunakan webhook (otomatis)
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

    if (error) {
      console.error('[fetchCoaFromAccurate] Edge Function error:', error);
      
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

    return {
      success: false,
      error: errorMsg,
    };
  }
}

// ============================================
// LOCAL DATABASE QUERIES (untuk display data)
// ============================================

/**
 * Get accounts untuk entity tertentu
 * Data ini di-populate via webhook secara otomatis
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
 * Ini auto-update UI saat webhook save data baru
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