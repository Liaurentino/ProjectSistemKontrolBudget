// accurate.ts - Complete with parent-child and edit/delete functions

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
  parent_id?: number | null;
  is_parent?: boolean;
  lvl?: number;
  created_at?: string;
  updated_at?: string;
}

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
  lvl: number;
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
      body: { action: 'exchangeCode', code },
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
// FETCH COA - Manual Sync
// ============================================

export async function fetchCoaFromAccurate(entityId: string, apiToken: string): Promise<FetchCoaResult> {
  try {
    console.log('[fetchCoaFromAccurate] Starting...');

    if (!apiToken) {
      return { success: false, error: 'API Token tidak ditemukan' };
    }

    const secretKey = HMAC_SECRET_KEY;
    if (!secretKey) {
      return { success: false, error: 'Secret key tidak dikonfigurasi' };
    }

    console.log('[fetchCoaFromAccurate] Calling Edge Function...');

    const { data, error } = await supabase.functions.invoke('accurate-fetch-coa', {
      body: { apiToken, secretKey, entityId },
    });

    if (error) {
      console.error('[fetchCoaFromAccurate] Edge error:', error);
      return { success: false, error: data?.error || error.message };
    }

    if (!data || !data.success) {
      return { success: false, error: data?.error || 'Fetch failed' };
    }

    console.log(`[fetchCoaFromAccurate] Fetched ${data.total} accounts`);
    return {
      success: true,
      accounts: data.accounts,
      total: data.total,
      pagination: data.pagination,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[fetchCoaFromAccurate] Error:', error);
    return { success: false, error: errorMsg };
  }
}

// ============================================
// LOCAL DATABASE QUERIES
// ============================================

export const getLocalAccounts = async (entityId: string) => {
  const { data, error } = await supabase
    .from('accurate_accounts')
    .select('*')
    .eq('entity_id', entityId)
    .eq('is_active', true)
    .order('account_code', { ascending: true });
  return { data, error };
};

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
// PARENT-CHILD HELPERS
// ============================================

/**
 * Calculate total balance for parent account (including all children recursively)
 */
export function calculateTotalBalance(
  accountId: number,
  accounts: CoaAccount[]
): number {
  const account = accounts.find(a => a.id === accountId);
  const children = accounts.filter(a => a.parent_id === accountId);
  
  const childrenTotal = children.reduce((sum, child) => {
    return sum + calculateTotalBalance(child.id, accounts);
  }, 0);
  
  return (account?.balance || 0) + childrenTotal;
}

/**
 * Get all child accounts for a parent (recursive)
 */
export function getChildAccounts(
  parentId: number,
  accounts: CoaAccount[]
): CoaAccount[] {
  const directChildren = accounts.filter(a => a.parent_id === parentId);
  const allChildren: CoaAccount[] = [...directChildren];
  
  directChildren.forEach(child => {
    const grandChildren = getChildAccounts(child.id, accounts);
    allChildren.push(...grandChildren);
  });
  
  return allChildren;
}

/**
 * Build hierarchical tree structure
 */
export function buildAccountTree(accounts: CoaAccount[]): CoaAccount[] {
  // Sort by account code for consistent ordering
  return accounts.sort((a, b) => a.account_code.localeCompare(b.account_code));
}

// ============================================
// EDIT ACCOUNT
// ============================================

export interface EditAccountData {
  account_code?: string;
  account_name?: string;
  account_type?: string;
  asOf?: string;         // Format: DD/MM/YYYY (required by Accurate)
  currencyCode?: string; // e.g., 'IDR'
}

export async function editAccount(
  entityId: string,
  accountId: number,
  updates: EditAccountData
) {
  try {
    console.log('[editAccount] Calling edge function...');
    console.log('[editAccount] Entity ID:', entityId);
    console.log('[editAccount] Account ID:', accountId);
    console.log('[editAccount] Updates:', updates);
    
    // Ensure required fields are present
    const completeUpdates = {
      ...updates,
      // Default asOf to today if not provided
      asOf: updates.asOf || new Date().toLocaleDateString('en-GB'), // DD/MM/YYYY
      // Default currencyCode to IDR if not provided
      currencyCode: updates.currencyCode || 'IDR',
    };
    
    console.log('[editAccount] Complete updates:', completeUpdates);
    
    const { data, error } = await supabase.functions.invoke('accurate-edit-account', {
      body: {
        entityId,
        accountId,
        updates: completeUpdates,
      },
    });

    console.log('[editAccount] Edge function response:', { data, error });

    if (error) {
      console.error('[editAccount] Edge error:', error);
      throw error;
    }

    if (!data?.success) {
      console.error('[editAccount] Edge function returned error:', data);
      throw new Error(data?.error || 'Failed to edit account');
    }

    console.log('[editAccount] ✅ Account updated successfully');
    return { success: true, data: data.data };
  } catch (error) {
    console.error('[editAccount] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// DELETE ACCOUNT
// ============================================

export async function deleteAccount(entityId: string, accountId: number) {
  try {
    console.log('[deleteAccount] Calling edge function...');
    
    const { data, error } = await supabase.functions.invoke('accurate-delete-account', {
      body: {
        entityId,
        accountId,
      },
    });

    if (error) {
      console.error('[deleteAccount] Edge error:', error);
      throw error;
    }

    if (!data?.success) {
      // Special handling for children warning
      if (data?.hasChildren) {
        return {
          success: false,
          hasChildren: true,
          children: data.children,
          error: data.message || 'Account has children',
        };
      }
      throw new Error(data?.error || 'Failed to delete account');
    }

    console.log('[deleteAccount] ✅ Account deleted successfully');
    return { success: true, message: data.message };
  } catch (error) {
    console.error('[deleteAccount] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// ENTITY OPERATIONS
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