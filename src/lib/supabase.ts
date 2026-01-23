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
// COA / CHART OF ACCOUNTS FUNCTIONS - DEBUG VERSION
// ============================================

export const importCoaFromExcel = async (accounts: any[]) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    console.log('[importCoaFromExcel] User check:', { user: !!user, error: userError });
    
    if (!user) {
      return { 
        data: null, 
        error: 'Tidak ada sesi aktif. Silakan login kembali.' 
      };
    }

    console.log('[importCoaFromExcel] Processing', accounts.length, 'accounts');
    console.log('[importCoaFromExcel] First account sample:', accounts[0]);

    // ========================================
    // CEK DUPLIKAT berdasarkan entity_id + account_code
    // ========================================
    const entityIds = [...new Set(accounts.map(a => a.entity_id))];
    const accountCodes = accounts.map(a => a.account_code);

    console.log('[importCoaFromExcel] Checking duplicates for:', {
      entityIds,
      accountCodes: accountCodes.slice(0, 5)
    });

    const { data: existingAccounts, error: checkError } = await supabase
      .from('accurate_accounts')
      .select('id, entity_id, account_code, accurate_id, account_name, account_type, balance, currency, suspended, source_type, parent_id, lvl')
      .in('entity_id', entityIds)
      .in('account_code', accountCodes);

    if (checkError) {
      console.error('[importCoaFromExcel] Check error:', checkError);
      return { data: null, error: checkError.message };
    }

    console.log('[importCoaFromExcel] Found existing accounts:', existingAccounts?.length || 0);
    if (existingAccounts && existingAccounts.length > 0) {
      console.log('[importCoaFromExcel] Sample existing account:', existingAccounts[0]);
    }

    // Buat map untuk cek duplikat: key = "entity_id-account_code"
    const existingMap = new Map(
      existingAccounts?.map(acc => [
        `${acc.entity_id}-${acc.account_code}`, 
        acc
      ]) || []
    );

    console.log('[importCoaFromExcel] Existing map size:', existingMap.size);
    console.log('[importCoaFromExcel] Existing map keys sample:', 
      Array.from(existingMap.keys()).slice(0, 3)
    );

    // ========================================
    // Transform accounts untuk database
    // ========================================
    let updateCount = 0;
    let insertCount = 0;

    const dbAccounts = accounts.map((acc: any) => {
      const key = `${acc.entity_id}-${acc.account_code}`;
      const existing = existingMap.get(key);

      console.log(`\n[importCoaFromExcel] Processing account: ${acc.account_code}`);
      console.log(`[importCoaFromExcel] Looking for key: "${key}"`);
      console.log(`[importCoaFromExcel] Existing found:`, !!existing);

      if (existing) {
        // DUPLICATE DETECTED - UPDATE HANYA BALANCE
        updateCount++;
        
        console.log(`[importCoaFromExcel] 🔄 UPDATING account ${acc.account_code}:`);
        console.log(`  - Old balance: ${existing.balance}`);
        console.log(`  - New balance: ${acc.balance}`);
        console.log(`  - Using accurate_id: ${existing.accurate_id}`);
        console.log(`  - Using id: ${existing.id}`);
        
        return {
          id: existing.id, // ✅ CRITICAL: Harus include ID untuk update
          entity_id: existing.entity_id,
          accurate_id: existing.accurate_id, // ✅ Gunakan accurate_id yang lama
          account_name: existing.account_name, // Tetap pakai yang lama
          account_code: existing.account_code,
          account_type: existing.account_type, // Tetap pakai yang lama
          account_type_name: existing.account_type,
          balance: acc.balance || 0, // ✅ UPDATE BALANCE BARU
          currency: existing.currency, // Tetap pakai yang lama
          suspended: existing.suspended,
          is_active: !existing.suspended,
          source_type: existing.source_type,
          parent_id: existing.parent_id,
          parent_accurate_id: null,
          lvl: existing.lvl,
          is_parent: false,
          hierarchy_path: null,
        };
      } else {
        // NEW ACCOUNT - INSERT SEMUA DATA
        insertCount++;
        
        console.log(`[importCoaFromExcel] ➕ INSERTING new account ${acc.account_code}`);
        
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        const accurateId = `EXCEL-${acc.entity_id}-${acc.account_code}-${timestamp}-${random}`;

        return {
          entity_id: acc.entity_id,
          accurate_id: accurateId,
          account_name: acc.account_name,
          account_code: acc.account_code,
          account_type: acc.account_type,
          account_type_name: acc.account_type,
          balance: acc.balance || 0,
          currency: acc.currency || 'IDR',
          suspended: acc.suspended || false,
          is_active: !acc.suspended,
          source_type: 'excel',
          parent_id: acc.parent_id,
          parent_accurate_id: null,
          lvl: acc.lvl || 1,
          is_parent: false,
          hierarchy_path: null,
        };
      }
    });

    console.log('\n[importCoaFromExcel] Summary BEFORE upsert:', {
      total: dbAccounts.length,
      toInsert: insertCount,
      toUpdate: updateCount
    });

    console.log('[importCoaFromExcel] First 2 transformed accounts:', dbAccounts.slice(0, 2));

    // ========================================
    // UPSERT ke database
    // ========================================
    console.log('[importCoaFromExcel] Starting upsert...');

    const { data, error } = await supabase
      .from('accurate_accounts')
      .upsert(dbAccounts, {
        onConflict: 'entity_id,accurate_id', // Conflict berdasarkan entity_id + accurate_id
        ignoreDuplicates: false, // Jangan ignore, kita mau update
      })
      .select();

    if (error) {
      console.error('[importCoaFromExcel] Upsert error:', error);
      console.error('[importCoaFromExcel] Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return { 
        data: null, 
        error: error.message || 'Gagal insert data ke database' 
      };
    }

    console.log('[importCoaFromExcel] Upsert successful!');
    console.log('[importCoaFromExcel] Returned rows:', data?.length || 0);
    if (data && data.length > 0) {
      console.log('[importCoaFromExcel] Sample returned data:', data[0]);
    }

    console.log('\n[importCoaFromExcel] Final Summary:', {
      total: dbAccounts.length,
      inserted: insertCount,
      updated: updateCount,
      returned: data?.length || 0
    });

    return { 
      data: { 
        count: data?.length || 0, 
        accounts: data,
        inserted: insertCount,
        updated: updateCount
      }, 
      error: null 
    };
    
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Gagal import Excel';
    console.error('[importCoaFromExcel] Unexpected error:', err);
    return { data: null, error };
  }
};

/**
 * Get COA by entity
 */
export const getCoaByEntity = async (entityId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('accurate_accounts')
      .select('*')
      .eq('entity_id', entityId)
      .order('account_code');
    
    return { data, error };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Gagal mengambil data COA';
    return { data: null, error };
  }
};

/**
 * Update COA account
 */
export const updateCoaAccount = async (id: string, updates: any) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('accurate_accounts')
      .update(updates)
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('[updateCoaAccount] Error:', error);
      return { 
        data: null, 
        error: error.message || 'Gagal update account' 
      };
    }

    console.log('[updateCoaAccount] Successfully updated account:', id);
    return { data, error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Gagal update account';
    console.error('[updateCoaAccount] Error:', error);
    return { data: null, error };
  }
};

/**
 * Delete COA account
 */
export const deleteCoaAccount = async (id: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { error: 'User not authenticated' };
    }

    console.log('[deleteCoaAccount] Deleting account:', id);

    // Delete langsung dari Supabase
    const { error } = await supabase
      .from('accurate_accounts')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('[deleteCoaAccount] Delete error:', error);
      return { 
        error: error.message || 'Gagal delete account' 
      };
    }

    console.log('[deleteCoaAccount] Successfully deleted account:', id);
    return { error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Gagal delete account';
    console.error('[deleteCoaAccount] Error:', error);
    return { error };
  }
};