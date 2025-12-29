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

// Entity functions
export const getEntities = async () => {
  const { data, error } = await supabase
    .from('entity')
    .select('*')
    .order('entity_name');
  
  return { data, error };
};

// Budget functions (updated with user_id and entity_id)
export const insertBudget = async (budgetData: {
  entity_id: string;  // Ganti dari entity ke entity_id
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
      entity:entity_id (
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

// Realisasi functions (updated with user_id)
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

if (typeof window !== 'undefined') {
  // @ts-ignore
  window.supabase = supabase;
  console.log('✅ Supabase exposed to window for debugging');
}