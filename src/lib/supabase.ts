import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Auth functions
export const signUp = (email: string, password: string) => {
  return supabase.auth.signUp({ email, password });
};

export const signIn = (email: string, password: string) => {
  return supabase.auth.signInWithPassword({ email, password });
};

export const signOut = () => {
  return supabase.auth.signOut();
};

export const getCurrentUser = () => {
  return supabase.auth.getUser();
};

// Budget functions
export const insertBudget = async (budgetData: {
  entity: string;
  department: string;
  total_budget: number;
  period: string;
  description?: string;
  categories_data: any[];
  user_id?: string;
}) => {
  const { data, error } = await supabase
    .from('budgets')
    .insert([budgetData])
    .select();

  return { data, error };
};

export const getBudgets = async () => {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .order('created_at', { ascending: false });

  return { data, error };
};

export const getBudgetById = async (id: string) => {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
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

// Realisasi functions
export const insertRealisasi = async (realisasiData: {
  budget_id: string;
  category_id?: string;
  amount: number;
  description?: string;
  date?: string;
  user_id?: string;
}) => {
  const { data, error } = await supabase
    .from('realisasi')
    .insert([realisasiData])
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
