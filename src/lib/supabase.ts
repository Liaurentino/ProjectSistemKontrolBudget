import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

// ============================================
// ENTITY FUNCTIONS (UPDATED WITH user_id)
// ============================================

export const getEntities = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('entity')
      .select('*')
      .eq('user_id', user.id)
      .order('entity_name');
    
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
};

export const getEntityById = async (entityId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('entity')
      .select('*')
      .eq('id', entityId)
      .eq('user_id', user.id)
      .single();
    
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
};

export const insertEntity = async (entityData: {
  entity_name: string;
  api_token: string;
  accurate_database_id?: number | null;
}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('entity')
      .insert([{
        ...entityData,
        user_id: user.id, // Automatically set user_id
      }])
      .select();
    
    if (error) throw error;
    
    return { data, error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Gagal menyimpan entitas';
    return { data: null, error };
  }
};

export const updateEntity = async (id: string, entityData: {
  entity_name?: string;
  api_token?: string;
  accurate_database_id?: number | null;
}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('entity')
      .update(entityData)
      .eq('id', id)
      .eq('user_id', user.id) // Ensure ownership
      .select();
    
    if (error) throw error;
    
    return { data, error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Gagal mengubah entitas';
    return { data: null, error };
  }
};

export const deleteEntity = async (id: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { error: 'User not authenticated' };
    }

    const { error } = await supabase
      .from('entity')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id); // Ensure ownership
    
    if (error) throw error;
    
    return { error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Gagal menghapus entitas';
    return { error };
  }
};

/**
 * Get entity by Accurate Database ID (for webhook)
 * Note: Untuk webhook dari Accurate, kita perlu cari entity berdasarkan accurate_database_id
 * tanpa filter user_id karena webhook bisa datang tanpa context user
 */
export const getEntityByAccurateDatabaseId = async (databaseId: number) => {
  const { data, error } = await supabase
    .from('entity')
    .select('*')
    .eq('accurate_database_id', databaseId)
    .single();
  
  return { data, error };
};

// ============================================
// BUDGET FUNCTIONS
// ============================================

export const insertBudget = async (budgetData: {
  entity_id: string;  
  department: string;
  total_budget: number;
  period: string;
  description?: string;
  categories_data: any[];
}) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('budgets')
    .insert([{
      ...budgetData,
      user_id: user?.id,
    }])
    .select();

  return { data, error };
};

export const getBudgets = async () => {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('budgets')
    .select(`
      *,
      entity: entity_id (
        id,
        entity_name
      )
    `)
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false });

  return { data, error };
};

export const getBudgetById = async (id: string) => {
  const { data, error } = await supabase
    .from('budgets')
    .select(`
      *,
      entity:entity_id (
        id,
        entity_name
      )
    `)
    .eq('id', id)
    .single();

  return { data, error };
};

export const updateBudget = async (id: string, updates: any) => {
  const { data, error } = await supabase
    .from('budgets')
    .update(updates)
    .eq('id', id)
    .select();

  return { data, error };
};

export const deleteBudget = async (id: string) => {
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', id);

  return { error };
};

// ============================================
// REALISASI FUNCTIONS
// ============================================

export const insertRealisasi = async (realisasiData: {
  budget_id: string;
  category?: string;
  amount: number;
  description?: string;
  date?: string;
}) => {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('realisasi')
    .insert([{
      ...realisasiData,
      user_id: user?.id,
    }])
    .select();

  return { data, error };
};

export const getRealisasiByBudget = async (budgetId: string) => {
  const { data, error } = await supabase
    .from('realisasi')
    .select('*')
    .eq('budget_id', budgetId)
    .order('date', { ascending: false });

  return { data, error };
};

export const updateRealisasi = async (id: string, updates: any) => {
  const { data, error } = await supabase
    .from('realisasi')
    .update(updates)
    .eq('id', id)
    .select();

  return { data, error };
};

export const deleteRealisasi = async (id: string) => {
  const { error } = await supabase
    .from('realisasi')
    .delete()
    .eq('id', id);

  return { error };
};

// ============================================
// DEBUG
// ============================================

if (typeof window !== 'undefined') {
  // @ts-ignore
  window.supabase = supabase;
  console.log('Supabase exposed to window for debugging');
}