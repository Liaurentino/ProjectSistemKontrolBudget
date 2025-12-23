import { supabase } from './supabase';

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

// Panggil Edge Function untuk ambil data dari Accurate
export const callAccurateAPI = async (
  action: 'getCategories' | 'getChartOfAccounts' | 'getTransactions',
  params?: Record<string, any>
) => {
  try {
    const { data, error } = await supabase.functions.invoke('accurate-sync', {
      body: { action, params },
    });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error calling Accurate API:', error);
    return { data: null, error };
  }
};

// Get kategori dari Accurate
export const getAccurateCategories = async () => {
  return callAccurateAPI('getCategories');
};

// Get chart of accounts dari Accurate
export const getChartOfAccounts = async () => {
  return callAccurateAPI('getChartOfAccounts');
};

// Get transactions dari Accurate
export const getAccurateTransactions = async () => {
  return callAccurateAPI('getTransactions');
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
    await supabase.from('accurate_sync_history').insert({
      sync_type: 'categories',
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

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

    await supabase.from('accurate_sync_history').insert({
      sync_type: 'accounts',
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return { data: null, error };
  }
};

// Get kategori dari database lokal
export const getLocalCategories = async () => {
  const { data, error } = await supabase
    .from('accurate_categories')
    .select('*')
    .eq('is_active', true);

  return { data, error };
};

// Get accounts dari database lokal
export const getLocalAccounts = async () => {
  const { data, error } = await supabase
    .from('accurate_accounts')
    .select('*')
    .eq('is_active', true);

  return { data, error };
};

// Mapping kategori budget ke kategori Accurate
export const mapBudgetToAccurate = async (
  budgetId: string,
  categoryName: string,
  accurateCategoryId: string
) => {
  const { data, error } = await supabase
    .from('budget_category_mapping')
    .insert({
      budget_id: budgetId,
      local_category_name: categoryName,
      accurate_category_id: accurateCategoryId,
    })
    .select();

  return { data, error };
};

// Get mapping untuk budget tertentu
export const getBudgetMappings = async (budgetId: string) => {
  const { data, error } = await supabase
    .from('budget_category_mapping')
    .select(`
      *,
      accurate_categories(name, code),
      accurate_accounts(account_name, account_code)
    `)
    .eq('budget_id', budgetId);

  return { data, error };
};

