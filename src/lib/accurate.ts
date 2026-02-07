import {
  saveTokens,
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
  id: string;
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
  coadate: string | null;
}

export interface FetchCoaResult {
  success: boolean;
  accounts?: CoaAccount[];
  total?: number;
  pagination?: any;
  error?: string;
}

export interface BSAccount {
  accountNo: string;
  accountName: string;
  accountType: string;
  amount: number;
  lvl: number;
  parentNo?: string;
  isParent: boolean;
}

export interface FetchBSAccountsResult {
  success: boolean;
  accounts?: BSAccount[];
  total?: number;
  period?: string;
  asOfDate?: string;
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
      saveTokens(data.access_token, data.refresh_token);
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
// ✅ EDIT ACCOUNT - HANYA NAMA & KODE
// ============================================

export interface EditAccountData {
  account_code?: string;
  account_name?: string;
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
    
    const { data, error } = await supabase.functions.invoke('accurate-edit-account', {
      body: {
        entityId,
        accountId,
        updates,
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

    console.log('[deleteAccount] Account deleted successfully');
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

// ============================================
// BUDGET TYPES
// ============================================

export interface Budget {
  id: string;
  name: string;
  entity_id: string;
  period: string; // Format: "YYYY-MM"
  total_budget: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BudgetItem {
  id: string;
  budget_id: string;
  account_id: string | null; // ✅ NULLABLE
  accurate_id?: string | null;
  account_code: string;
  account_name: string;
  account_type?: string | null;
  allocated_amount: number;
  realisasi_snapshot?: number;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}


export interface BudgetWithItems extends Budget {
  items: BudgetItem[];
  total_allocated: number;
  total_realisasi?: number; // Total realisasi from manual input
  remaining_budget: number;
  status: 'OVER_BUDGET' | 'FULLY_ALLOCATED' | 'UNDER_BUDGET';
}

export interface CreateBudgetData {
  entity_id: string;
  name: string;
  period: string;
  total_budget: number;
  description?: string;
}

export interface CreateBudgetItemData {
  budget_id: string;
  account_id?: string | null; // ✅ OPTIONAL & NULLABLE
  accurate_id?: string | null;
  account_code: string;
  account_name: string;
  account_type?: string | null;
  allocated_amount: number;
  realisasi_snapshot?: number;
  description?: string | null;
}

// ============================================
// BUDGET CRUD OPERATIONS
// ============================================

/**
 * Get all budgets for an entity
 */
export async function getBudgets(entityId: string) {
  try {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('entity_id', entityId)
      .order('period', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[getBudgets] Error:', error);
    return { data: null, error };
  }
}

/**
 * Get budgets for a specific year
 */
export async function getBudgetsByYear(entityId: string, year: string) {
  try {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('entity_id', entityId)
      .like('period', `${year}-%`)
      .order('period', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[getBudgetsByYear] Error:', error);
    return { data: null, error };
  }
}

/**
 * Get single budget with items
 */
export async function getBudgetById(budgetId: string): Promise<{ data: BudgetWithItems | null; error: any }> {
  try {
    // Get budget header
    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .select('*')
      .eq('id', budgetId)
      .single();

    if (budgetError) throw budgetError;

    // Get budget items
    const { data: items, error: itemsError } = await supabase
      .from('budget_items')
      .select('*')
      .eq('budget_id', budgetId)
      .order('account_code', { ascending: true });

    if (itemsError) throw itemsError;

    // Calculate totals
    const total_allocated = items?.reduce((sum, item) => sum + (item.allocated_amount || 0), 0) || 0;
    const total_realisasi = items?.reduce((sum, item) => sum + (item.realisasi_snapshot || 0), 0) || 0;
    const remaining_budget = budget.total_budget - total_allocated;
    
    let status: 'OVER_BUDGET' | 'FULLY_ALLOCATED' | 'UNDER_BUDGET';
    if (total_allocated > budget.total_budget) {
      status = 'OVER_BUDGET';
    } else if (total_allocated === budget.total_budget) {
      status = 'FULLY_ALLOCATED';
    } else {
      status = 'UNDER_BUDGET';
    }

    const budgetWithItems: BudgetWithItems = {
      ...budget,
      items: items || [],
      total_allocated,
      total_realisasi,
      remaining_budget,
      status,
    };

    return { data: budgetWithItems, error: null };
  } catch (error) {
    console.error('[getBudgetById] Error:', error);
    return { data: null, error };
  }
}

/**
 * Create new budget
 */
export async function createBudget(budgetData: CreateBudgetData) {
  try {
    const { data, error } = await supabase
      .from('budgets')
      .insert({
        entity_id: budgetData.entity_id,
        name: budgetData.name,
        period: budgetData.period,
        total_budget: budgetData.total_budget,
        description: budgetData.description,
      })
      .select()
      .single();

    if (error) throw error;

    console.log('[createBudget] Created:', data);
    return { data, error: null };
  } catch (error) {
    console.error('[createBudget] Error:', error);
    return { data: null, error };
  }
}

/**
 * Update budget
 */
export async function updateBudget(budgetId: string, updates: Partial<Budget>) {
  try {
    const { data, error } = await supabase
      .from('budgets')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', budgetId)
      .select()
      .single();

    if (error) throw error;

    console.log('[updateBudget] Updated:', data);
    return { data, error: null };
  } catch (error) {
    console.error('[updateBudget] Error:', error);
    return { data: null, error };
  }
}

/**
 * Delete budget (cascade delete items)
 */
export async function deleteBudget(budgetId: string) {
  try {
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', budgetId);

    if (error) throw error;

    console.log('[deleteBudget] Deleted budget:', budgetId);
    return { error: null };
  } catch (error) {
    console.error('[deleteBudget] Error:', error);
    return { error };
  }
}

// ============================================
// BUDGET ITEMS OPERATIONS
// ============================================

/**
 * Get budget items for a budget
 */
export async function getBudgetItems(budgetId: string) {
  try {
    const { data, error } = await supabase
      .from('budget_items')
      .select('*')
      .eq('budget_id', budgetId)
      .order('account_code', { ascending: true });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[getBudgetItems] Error:', error);
    return { data: null, error };
  }
}

/**
 * ✅ FIXED: Add budget item with proper validation
 */
export async function addBudgetItem(itemData: CreateBudgetItemData) {
  try {
    // ✅ Check duplicate dengan maybeSingle()
    const { data: existing, error: checkError } = await supabase
      .from('budget_items')
      .select('id')
      .eq('budget_id', itemData.budget_id)
      .eq('account_code', itemData.account_code)
      .maybeSingle();

    if (checkError) {
      console.error('[addBudgetItem] Error checking duplicate:', checkError);
      throw checkError;
    }

    if (existing) {
      throw new Error(`Akun ${itemData.account_code} sudah ada di budget ini`);
    }

    // ✅ Clean data (convert empty string to null)
    const insertData = {
      budget_id: itemData.budget_id,
      account_id: itemData.account_id || null,
      accurate_id: itemData.accurate_id || null,
      account_code: itemData.account_code,
      account_name: itemData.account_name,
      account_type: itemData.account_type || null,
      allocated_amount: itemData.allocated_amount,
      realisasi_snapshot: itemData.realisasi_snapshot || 0,
      description: itemData.description || null,
    };

    console.log('[addBudgetItem] Inserting:', insertData);

    const { data, error } = await supabase
      .from('budget_items')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    console.log('[addBudgetItem] ✅ Added:', data);
    return { data, error: null };
  } catch (error) {
    console.error('[addBudgetItem] ❌ Error:', error);
    return { data: null, error };
  }
}

/**
 * Update budget item
 */
export async function updateBudgetItem(itemId: string, updates: Partial<BudgetItem>) {
  try {
    const { data, error } = await supabase
      .from('budget_items')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;

    console.log('[updateBudgetItem] Updated:', data);
    return { data, error: null };
  } catch (error) {
    console.error('[updateBudgetItem] Error:', error);
    return { data: null, error };
  }
}

/**
 * Delete budget item
 */
export async function deleteBudgetItem(itemId: string) {
  try {
    const { error } = await supabase
      .from('budget_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;

    console.log('[deleteBudgetItem] Deleted item:', itemId);
    return { error: null };
  } catch (error) {
    console.error('[deleteBudgetItem] Error:', error);
    return { error };
  }
}

// ============================================
// VALIDATION & HELPERS
// ============================================

/**
 * Validate budget allocation
 */
export async function validateBudgetAllocation(budgetId: string) {
  try {
    const { data: budget } = await getBudgetById(budgetId);
    
    if (!budget) {
      return { isValid: false, message: 'Budget tidak ditemukan' };
    }

    if (budget.total_allocated > budget.total_budget) {
      return {
        isValid: false,
        message: `Over budget: Rp ${(budget.total_allocated - budget.total_budget).toLocaleString('id-ID')}`,
        status: 'OVER_BUDGET',
        total_allocated: budget.total_allocated,
        total_budget: budget.total_budget,
        remaining: budget.remaining_budget,
      };
    }

    return {
      isValid: true,
      message: 'Budget allocation valid',
      status: budget.status,
      total_allocated: budget.total_allocated,
      total_budget: budget.total_budget,
      remaining: budget.remaining_budget,
    };
  } catch (error) {
    console.error('[validateBudgetAllocation] Error:', error);
    return { isValid: false, message: 'Validation error' };
  }
}

/**
 * Check if account is already used in budget
 */
export async function isAccountUsedInBudget(budgetId: string, accountCode: string) {
  try {
    const { data } = await supabase
      .from('budget_items')
      .select('id')
      .eq('budget_id', budgetId)
      .eq('account_code', accountCode)
      .single();

    return !!data;
  } catch (error) {
    return false;
  }
}

/**
 * Get available accounts for budget (not yet used)
 */
export async function getAvailableAccountsForBudget(entityId: string, budgetId?: string) {
  try {
    // Get all active accounts
    const { data: allAccounts, error: accountsError } = await supabase
      .from('accurate_accounts')
      .select('*')
      .eq('entity_id', entityId)
      .eq('is_active', true)
      .order('account_code', { ascending: true });

    if (accountsError) throw accountsError;

    // If no budgetId, return all accounts
    if (!budgetId) {
      return { data: allAccounts, error: null };
    }

    // Get used accounts in this budget
    const { data: usedItems, error: usedError } = await supabase
      .from('budget_items')
      .select('account_code')
      .eq('budget_id', budgetId);

    if (usedError) throw usedError;

    const usedCodes = new Set(usedItems?.map(item => item.account_code) || []);
    const availableAccounts = allAccounts?.filter(acc => !usedCodes.has(acc.account_code)) || [];

    return { data: availableAccounts, error: null };
  } catch (error) {
    console.error('[getAvailableAccountsForBudget] Error:', error);
    return { data: null, error };
  }
}

/**
 * Subscribe to budget changes
 */
export function subscribeBudgets(entityId: string, onChange: () => void) {
  return supabase
    .channel(`budgets_${entityId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'budgets',
        filter: `entity_id=eq.${entityId}`,
      },
      () => onChange()
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'budget_items',
      },
      () => onChange()
    )
    .subscribe();
}

// ============================================
// GET BUDGET REALIZATIONS LIVE (No Sync Required)
// ============================================

/**
 * Get budget realizations with live data from accurate_accounts
 */
export async function getBudgetRealizationsLive(
  entityId?: string,
  period?: string,
  accountType?: string,
  budgetName?: string
) {
  try {
    // STEP 1: Query budgets
    let budgetQuery = supabase
      .from('budgets')
      .select('id, name, period, entity_id');

    if (entityId) {
      budgetQuery = budgetQuery.eq('entity_id', entityId);
    }
    if (period) {
      budgetQuery = budgetQuery.eq('period', period);
    }
    if (budgetName) {
      budgetQuery = budgetQuery.eq('name', budgetName);
    }

    const { data: budgets, error: budgetError } = await budgetQuery;

    if (budgetError) throw budgetError;
    
    // PENTING: Return empty array kalau tidak ada budgets
    if (!budgets || budgets.length === 0) {
      return { data: [], error: null };
    }

    // STEP 2: Query budget_items
    const budgetIds = budgets.map(b => b.id);

    let itemQuery = supabase
      .from('budget_items')
      .select('*')
      .in('budget_id', budgetIds)
      .order('account_code', { ascending: true });

    if (accountType) {
      itemQuery = itemQuery.eq('account_type', accountType);
    }

    const { data: items, error: itemError } = await itemQuery;

    if (itemError) throw itemError;

    // PENTING: Return empty array kalau tidak ada items
    if (!items || items.length === 0) {
      return { data: [], error: null };
    }

    // STEP 3: Transform
    const realizations: BudgetRealization[] = items.map((item: any) => {
      const budget = budgets.find(b => b.id === item.budget_id);
      const budgetAllocated = item.allocated_amount || 0;  
      const realisasi = item.realisasi_snapshot || 0;  
      const variance = budgetAllocated - realisasi;
      const variancePercentage = budgetAllocated > 0 ? (variance / budgetAllocated) * 100 : 0;
      const status = realisasi <= budgetAllocated ? 'ON_TRACK' : 'OVER_BUDGET';

      return {
        id: item.id,
        budget_id: item.budget_id,
        budget_item_id: item.id,
        entity_id: budget?.entity_id || '',
        period: budget?.period || '',
        account_id: item.account_id,
        accurate_id: item.accurate_id,
        account_code: item.account_code,
        account_name: item.account_name,
        account_type: item.account_type,
        budget_allocated: budgetAllocated,
        realisasi: realisasi,
        variance: variance,
        variance_percentage: variancePercentage,
        status: status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        budgets: {
          name: budget?.name || '',
        },
      };
    });

    console.log('[getBudgetRealizationsLive] ✅ Success:', realizations.length, 'items');
    return { data: realizations, error: null };
    
  } catch (error) {
    console.error('[getBudgetRealizationsLive] ❌ Error:', error);
    // CRITICAL: Return empty array, NOT null!
    return { data: [], error };
  }
}
/**
 * Get realization summary (calculated from live data, no view needed)
 */
export async function getRealizationSummaryLive(
  entityId?: string,
  period?: string
) {
  try {
    const { data: realizations, error } = await getBudgetRealizationsLive(
      entityId,
      period
    );

    if (error) throw error;
    if (!realizations || realizations.length === 0) return { data: null, error: null };

    // Calculate summary
    const totalBudget = realizations.reduce((sum, item) => sum + item.budget_allocated, 0);
    const totalRealisasi = realizations.reduce((sum, item) => sum + item.realisasi, 0);
    const totalVariance = totalBudget - totalRealisasi;
    const variancePercentage = totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0;
    const overallStatus = totalRealisasi <= totalBudget ? 'ON_TRACK' : 'OVER_BUDGET';

    const summary = {
      entity_id: entityId || '',
      entity_name: '',
      period: period || 'all',
      total_accounts: realizations.length,
      total_budgets: [...new Set(realizations.map(item => item.budget_id))].length,
      total_budget: totalBudget,
      total_realisasi: totalRealisasi,
      total_variance: totalVariance,
      variance_percentage: variancePercentage,
      overall_status: overallStatus,
      on_track_count: realizations.filter(item => item.status === 'ON_TRACK').length,
      over_budget_count: realizations.filter(item => item.status === 'OVER_BUDGET').length,
      last_updated: new Date().toISOString(),
    };

    console.log('[getRealizationSummaryLive] Calculated summary');
    return { data: summary, error: null };
  } catch (error) {
    console.error('[getRealizationSummaryLive] Error:', error);
    return { data: null, error };
  }
}

/**
 * Get available periods from budgets
 */
export async function getAvailableRealizationPeriods(entityId?: string) {
  try {
    let query = supabase
      .from('budgets')
      .select('period')
      .order('period', { ascending: false });

    if (entityId) {
      query = query.eq('entity_id', entityId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Get unique periods
    const periods = [...new Set(data?.map(item => item.period) || [])];

    return { data: periods, error: null };
  } catch (error) {
    console.error('[getAvailableRealizationPeriods] Error:', error);
    return { data: null, error };
  }
}

/**
 * Get available account types from budget_items
 */
export async function getAvailableAccountTypes(entityId?: string, period?: string) {
  try {
    let query = supabase
      .from('budget_items')
      .select('account_type, budgets!inner(entity_id, period)')
      .order('account_type', { ascending: true });

    if (entityId) {
      query = query.eq('budgets.entity_id', entityId);
    }

    if (period) {
      query = query.eq('budgets.period', period);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Get unique account types
    const types = [...new Set(data?.map(item => item.account_type).filter(Boolean) || [])];

    return { data: types, error: null };
  } catch (error) {
    console.error('[getAvailableAccountTypes] Error:', error);
    return { data: null, error };
  }
}

/**
 * Get available budget names from budgets
 */
export async function getAvailableBudgetGroups(entityId?: string, period?: string) {
  try {
    let query = supabase
      .from('budgets')
      .select('name')
      .order('name', { ascending: true });

    if (entityId) {
      query = query.eq('entity_id', entityId);
    }

    if (period) {
      query = query.eq('period', period);
    }

    const { data, error } = await query;
    if (error) throw error;

    const groups = [...new Set(
      data?.map(item => item.name).filter(Boolean) || []
    )].sort();

    return { data: groups, error: null };
  } catch (error) {
    console.error('[getAvailableBudgetGroups] Error:', error);
    return { data: null, error };
  }
}

// ============================================
// SUBSCRIBE TO CHANGES
// ============================================

/**
 * Subscribe to budget items and accounts changes for real-time updates
 */
export function subscribeBudgetItems(
  entityId: string,
  onChange: () => void
) {
  const channel = supabase.channel(`budget_items_${entityId}`);

  // Subscribe to budget_items changes
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'budget_items',
    },
    (payload) => {
      console.log('[subscribeBudgetItems] Budget items change detected', payload);
      onChange();
    }
  );

  // Subscribe to accurate_accounts changes (for balance updates)
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'accurate_accounts',
    },
    (payload) => {
      console.log('[subscribeBudgetItems] Account balance change detected', payload);
      onChange();
    }
  );

  return channel.subscribe();
}

export async function fetchBSAccountsByPeriod(
  apiToken: string,
  period: string
): Promise<FetchBSAccountsResult> {
  try {
    console.log('[fetchBSAccountsByPeriod] Starting for period:', period);

    if (!apiToken) {
      return { success: false, error: 'API Token tidak ditemukan' };
    }

    const secretKey = HMAC_SECRET_KEY;
    if (!secretKey) {
      return { success: false, error: 'Secret key tidak dikonfigurasi' };
    }

    // Validate period format
    const periodRegex = /^\d{4}-\d{2}$/;
    if (!periodRegex.test(period)) {
      return { 
        success: false, 
        error: 'Format periode tidak valid. Gunakan format YYYY-MM (contoh: 2026-02)' 
      };
    }

    console.log('[fetchBSAccountsByPeriod] Calling Edge Function...');

    const { data, error } = await supabase.functions.invoke('accurate-fetch-bs-accounts', {
      body: { apiToken, secretKey, period },
    });

    if (error) {
      console.error('[fetchBSAccountsByPeriod] Edge error:', error);
      return { success: false, error: data?.error || error.message };
    }

    if (!data || !data.success) {
      return { success: false, error: data?.error || 'Fetch failed' };
    }

    console.log(`[fetchBSAccountsByPeriod] Fetched ${data.total} accounts for period ${period}`);
    return {
      success: true,
      accounts: data.accounts,
      total: data.total,
      period: data.period,
      asOfDate: data.asOfDate,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[fetchBSAccountsByPeriod] Error:', error);
    return { success: false, error: errorMsg };
  }
}

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface BudgetRealization {
  id: string;
  budget_id: string;
  budget_item_id: string;
  entity_id: string;
  period: string;
  account_id?: string;
  accurate_id?: string;
  account_code: string;
  account_name: string;
  account_type?: string;
  budget_allocated: number;
  realisasi: number;
  variance: number;
  variance_percentage: number;
  status: 'ON_TRACK' | 'OVER_BUDGET';
  notes?: string;
  created_at: string;
  updated_at: string;
  budgets?: {
    name: string;
  };
}

export interface BudgetRealizationSummary {
  entity_id: string;
  entity_name: string;
  period: string;
  total_accounts: number;
  total_budgets: number;
  total_budget: number;
  total_realisasi: number;
  total_variance: number;
  variance_percentage: number;
  overall_status: 'ON_TRACK' | 'OVER_BUDGET';
  on_track_count: number;
  over_budget_count: number;
  last_updated: string;
}

export interface SyncRealizationResult {
  synced_count: number;
  message: string;
}