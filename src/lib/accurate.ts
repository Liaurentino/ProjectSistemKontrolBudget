import { supabase } from './supabase';

const CLIENT_ID = import.meta.env.VITE_ACCURATE_CLIENT_ID!;
const REDIRECT_URI = import.meta.env.VITE_ACCURATE_REDIRECT_URI!;

interface Category {
  accurate_id: string;
  name: string;
  code: string;
  description?: string;
}

interface Account {
  accurate_id: string;
  account_name: string;
  account_code: string;
  account_type: string;
}

export interface GLAccount {
  id: number;
  number: string;
  name: string;
  accountType?: string;
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

// ✅ KEYS untuk localStorage (namespaced untuk avoid conflict)
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accurate_access_token',
  REFRESH_TOKEN: 'accurate_refresh_token',
  EXPIRES_AT: 'accurate_expires_at',
} as const;

/**
 * 1. Generate Accurate Authorization URL
 */
export const getAuthorizationUrl = () => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: 'bank_read sales_read',
  });

  return `https://account.accurate.id/oauth/authorize?${params.toString()}`;
};

/**
 * 2. Exchange authorization code → access token
 * Dilakukan lewat Supabase Edge Function (AMAN)
 */
export const exchangeCodeForToken = async (code: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('accurate-oauth', {
      body: {
        action: 'exchangeCode',
        code,
      },
    });

    if (error) throw error;

    // ✅ SAFE SAVE dengan validasi
    if (data?.access_token && data?.refresh_token && data?.expires_in) {
      try {
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
        localStorage.setItem(
          STORAGE_KEYS.EXPIRES_AT,
          String(Date.now() + data.expires_in * 1000)
        );
      } catch (storageError) {
        console.error('Error saving to localStorage:', storageError);
        // Tidak throw error, biarkan app tetap jalan
      }
    }

    return data;
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    throw error;
  }
};

/**
 * 3. Ambil token dari storage (SAFE)
 */
export const getAccessToken = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  } catch (error) {
    console.error('Error reading access token:', error);
    return null;
  }
};

/**
 * 4. Cek token expired (SAFE)
 */
export const isTokenExpired = () => {
  try {
    const expiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
    if (!expiresAt) return true;
    
    const expiryTime = Number(expiresAt);
    if (isNaN(expiryTime)) return true;
    
    return Date.now() > expiryTime;
  } catch (error) {
    console.error('Error checking token expiry:', error);
    return true; // Assume expired kalau error
  }
};

/**
 * 4b. Clear Accurate tokens (untuk logout atau error)
 */
export const clearAccurateTokens = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
  } catch (error) {
    console.error('Error clearing accurate tokens:', error);
  }
};

/**
 * 5. Call Accurate API (DATA API → accurate.id)
 */
export const callAccurateAPI = async (
  endpoint: string,
  options: RequestInit = {}
) => {
  const token = getAccessToken();

  if (!token) {
    throw new Error('Access token tidak ditemukan. Silakan authorize ulang.');
  }

  if (isTokenExpired()) {
    clearAccurateTokens(); // Clear expired tokens
    throw new Error('Access token expired. Silakan authorize ulang.');
  }

  try {
    const response = await fetch(`https://accurate.id${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      
      // Jika unauthorized, clear tokens
      if (response.status === 401) {
        clearAccurateTokens();
      }
      
      throw new Error(`Accurate API ${response.status}: ${text}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error calling Accurate API:', error);
    throw error;
  }
};

// ✅ SAFE: Get kategori dari Accurate
export const getAccurateCategories = async () => {
  try {
    return await callAccurateAPI('/api/categories'); // Sesuaikan endpoint
  } catch (error) {
    console.error('Error getting Accurate categories:', error);
    throw error;
  }
};

// ✅ SAFE: Get chart of accounts dari Accurate
export const getChartOfAccounts = async () => {
  try {
    return await callAccurateAPI('/api/accounts'); // Sesuaikan endpoint
  } catch (error) {
    console.error('Error getting chart of accounts:', error);
    throw error;
  }
};

// ✅ SAFE: Get transactions dari Accurate
export const getAccurateTransactions = async () => {
  try {
    return await callAccurateAPI('/api/transactions'); // Sesuaikan endpoint
  } catch (error) {
    console.error('Error getting Accurate transactions:', error);
    throw error;
  }
};

// Simpan kategori yang disinkronkan ke database lokal
export const syncAccurateCategories = async (categories: Category[]) => {
  try {
    const { data, error } = await supabase.from('accurate_categories').upsert(
      categories.map((cat) => ({
        accurate_id: cat.accurate_id,
        name: cat.name,
        code: cat.code,
        description: cat.description,
      })),
      { onConflict: 'accurate_id' }
    );

    if (error) throw error;

    // Log sync history
    await supabase.from('accurate_sync_history').insert({
      sync_type: 'categories',
      status: 'success',
      records_synced: categories.length,
    });

    return { data, error: null };
  } catch (error) {
    console.error('Error syncing categories:', error);

    // Log error
    try {
      await supabase.from('accurate_sync_history').insert({
        sync_type: 'categories',
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (logError) {
      console.error('Error logging sync failure:', logError);
    }

    return { data: null, error };
  }
};

// Simpan accounts yang disinkronkan ke database lokal
export const syncAccurateAccounts = async (accounts: Account[]) => {
  try {
    const { data, error } = await supabase.from('accurate_accounts').upsert(
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

// Get kategori dari database lokal
export const getLocalCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('accurate_categories')
      .select('*')
      .eq('is_active', true);

    return { data, error };
  } catch (error) {
    console.error('Error getting local categories:', error);
    return { data: null, error };
  }
};

// Get accounts dari database lokal
export const getLocalAccounts = async () => {
  try {
    const { data, error } = await supabase
      .from('accurate_accounts')
      .select('*')
      .eq('is_active', true);

    return { data, error };
  } catch (error) {
    console.error('Error getting local accounts:', error);
    return { data: null, error };
  }
};

// Mapping kategori budget ke kategori Accurate
export const mapBudgetToAccurate = async (
  budgetId: string,
  categoryName: string,
  accurateCategoryId: string
) => {
  try {
    const { data, error } = await supabase
      .from('budget_category_mapping')
      .insert({
        budget_id: budgetId,
        local_category_name: categoryName,
        accurate_category_id: accurateCategoryId,
      })
      .select();

    return { data, error };
  } catch (error) {
    console.error('Error mapping budget to accurate:', error);
    return { data: null, error };
  }
};

// Get mapping untuk budget tertentu
export const getBudgetMappings = async (budgetId: string) => {
  try {
    const { data, error } = await supabase
      .from('budget_category_mapping')
      .select(`
        *,
        accurate_categories(name, code),
        accurate_accounts(account_name, account_code)
      `)
      .eq('budget_id', budgetId);

    return { data, error };
  } catch (error) {
    console.error('Error getting budget mappings:', error);
    return { data: null, error };
  }
};

export async function getGLAccountList(
  sessionId: string,
  host: string,
  filter?: string,
  fields?: string
): Promise<GLAccountListResponse> {
  try {
    const url = new URL(`${host}/accurate/api/glaccount/list.do`);
    
    // Add query parameters if provided
    const params: Record<string, string> = {};
    if (filter) params.filter = filter;
    if (fields) params.fields = fields;
    
    Object.keys(params).forEach(key => 
      url.searchParams.append(key, params[key])
    );

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: GLAccountListResponse = await response.json();
    
    if (!data.s) {
      throw new Error('API returned error status');
    }

    return data;
  } catch (error) {
    console.error('Error fetching GL Account list:', error);
    throw error;
  }
}

export async function searchGLAccounts(
  sessionId: string,
  host: string,
  keyword: string
): Promise<GLAccountListResponse> {
  const filter = `number.CONTAINS('${keyword}') OR name.CONTAINS('${keyword}')`;
  return getGLAccountList(sessionId, host, filter);
}