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

const CLIENT_ID = import.meta.env.VITE_ACCURATE_CLIENT_ID! ;
const REDIRECT_URI = import.meta. env.VITE_ACCURATE_REDIRECT_URI!;
const HMAC_SECRET_KEY = import.meta.env. VITE_ACCURATE_HMAC_SECRET || '';

// ============================================
// TYPES
// ============================================

export interface Category {
  accurate_id: string;
  name: string;
  code: string;
  description?:  string;
}

export interface Account {
  accurate_id: string;
  account_name: string;
  account_code: string;
  account_type: string;
}

export interface GLAccount {
  id: number;
  number: string;
  name: string;
  accountType?:  string;
  isActive?: boolean;
}

export interface GLAccountListResponse {
  s: boolean;
  d: GLAccount[];
  sp?:  {
    pageCount: number;
    page: number;
  };
}

// Export types dari middleware
export type { AccurateValidationResult, AccurateDatabase };

// ============================================
// OAUTH FLOW
// ============================================

/**
 * Generate Accurate Authorization URL
 */
export const getAuthorizationUrl = () => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: 'read write',
  });

  return `https://account.accurate.id/oauth/authorize?${params. toString()}`;
};

/**
 * Exchange authorization code for access token
 */
export const exchangeCodeForToken = async (code: string) => {
  try {
    const { data, error } = await supabase.functions. invoke('accurate-oauth', {
      body: {
        action: 'exchangeCode',
        code,
      },
    });

    if (error) throw error;

    if (data?.access_token && data?. refresh_token && data?.expires_in) {
      saveTokens(data.access_token, data.refresh_token, data.expires_in);
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    return { data: null, error };
  }
};

// ============================================
// DATABASE / ENTITAS OPERATIONS
// ============================================

/**
 * Validate API Token dan ambil database list
 */
export const validateEntitasToken = async (
  apiToken: string,
  secretKey: string = HMAC_SECRET_KEY
): Promise<AccurateValidationResult> => {
  return validateAccurateApiToken(apiToken, secretKey);
};

/**
 * Get database list dari Accurate
 */
export const getEntitasList = async (
  apiToken:  string,
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
// SYNC TO LOCAL DATABASE
// ============================================

/**
 * Sync categories to local database
 */
export const syncAccurateCategories = async (categories: Category[]) => {
  try {
    const { data, error } = await supabase
      .from('accurate_categories')
      .upsert(
        categories.map((cat) => ({
          accurate_id: cat.accurate_id,
          name: cat.name,
          code: cat.code,
          description: cat.description,
        })),
        { onConflict: 'accurate_id' }
      );

    if (error) throw error;

    await supabase.from('accurate_sync_history').insert({
      sync_type: 'categories',
      status: 'success',
      records_synced: categories.length,
    });

    return { data, error: null };
  } catch (error) {
    console.error('Error syncing categories:', error);

    try {
      await supabase. from('accurate_sync_history').insert({
        sync_type:  'categories',
        status:  'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (logError) {
      console.error('Error logging sync failure:', logError);
    }

    return { data: null, error };
  }
};

/**
 * Sync accounts to local database
 */
export const syncAccurateAccounts = async (accounts: Account[]) => {
  try {
    const { data, error } = await supabase
      .from('accurate_accounts')
      .upsert(
        accounts.map((acc) => ({
          accurate_id: acc.accurate_id,
          account_name: acc.account_name,
          account_code: acc.account_code,
          account_type: acc.account_type,
        })),
        { onConflict: 'accurate_id' }
      );

    if (error) throw error;

    await supabase.from('accurate_sync_history').insert({
      sync_type: 'accounts',
      status: 'success',
      records_synced: accounts.length,
    });

    return { data, error: null };
  } catch (error) {
    console.error('Error syncing accounts:', error);

    try {
      await supabase.from('accurate_sync_history').insert({
        sync_type: 'accounts',
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (logError) {
      console.error('Error logging sync failure:', logError);
    }

    return { data: null, error };
  }
};

// ============================================
// LOCAL DATABASE QUERIES
// ============================================

/**
 * Get categories from local database
 */
export const getLocalCategories = async () => {
  const { data, error } = await supabase
    .from('accurate_categories')
    .select('*')
    .eq('is_active', true);

  return { data, error };
};

/**
 * Get accounts from local database
 */
export const getLocalAccounts = async () => {
  const { data, error } = await supabase
    .from('accurate_accounts')
    .select('*')
    .eq('is_active', true);

  return { data, error };
};

// ============================================
// GL ACCOUNT METHODS
// ============================================

export async function getGLAccountList(
  sessionId: string,
  host:  string,
  filter?: string,
  fields?: string
): Promise<GLAccountListResponse> {
  try {
    const url = new URL(`${host}/accurate/api/glaccount/list. do`);

    const params:  Record<string, string> = {};
    if (filter) params.filter = filter;
    if (fields) params.fields = fields;

    Object.keys(params).forEach((key) =>
      url.searchParams.append(key, params[key])
    );

    throw new Error('GL Account fetch not implemented yet');
  } catch (error) {
    console.error('Error fetching GL Account list:', error);
    throw error;
  }
}

export async function searchGLAccounts(
  sessionId: string,
  host:  string,
  keyword: string
): Promise<GLAccountListResponse> {
  const filter = `number.CONTAINS('${keyword}') OR name.CONTAINS('${keyword}')`;
  return getGLAccountList(sessionId, host, filter);
}