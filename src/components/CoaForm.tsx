import { useEffect, useState } from 'react';
import { useEntity } from '../contexts/EntityContext';
import {
  fetchCoaFromAccurate,
  getLocalAccounts,
  subscribeAccounts,
  calculateTotalBalance,
  editAccount,
  type CoaAccount,
  type EditAccountData,
} from '../lib/accurate';
import { deleteCoaAccount } from '../lib/supabase';

interface ExpandedState {
  [accountId: number]: boolean;
}

interface CoaAccountExtended extends CoaAccount {
  db_id: string;
}

export const useCoaForm = () => {
  const [accounts, setAccounts] = useState<CoaAccountExtended[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  
  const [expanded, setExpanded] = useState<ExpandedState>({});
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CoaAccountExtended | null>(null);
  const [editForm, setEditForm] = useState<EditAccountData>({});
  const [editLoading, setEditLoading] = useState(false);
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<CoaAccountExtended | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [showFinalConfirmModal, setShowFinalConfirmModal] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const { activeEntity } = useEntity();

  // ============================================
  // LOAD COA FROM DATABASE
  // ============================================
  async function loadCoaFromDatabase() {
    if (!activeEntity?.id) {
      console.log('[CoaForm] No active entity');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[CoaForm] Loading COA from database');

      const { data, error: dbError } = await getLocalAccounts(activeEntity.id);

      if (dbError) {
        throw new Error(dbError.message);
      }

      if (!data || data.length === 0) {
        setAccounts([]);
        return;
      }

      const mappedAccounts: CoaAccountExtended[] = data.map((acc: any) => ({
        db_id: acc.id,
        id: parseInt(acc.accurate_id) || 0,
        account_code: acc.account_code || '',
        account_name: acc.account_name || '',
        account_type: acc.account_type || 'UNKNOWN',
        account_type_name: acc.account_type_name || acc.account_type || 'Unknown',
        balance: parseFloat(acc.balance) || 0,
        currency: acc.currency || 'IDR',
        is_parent: acc.is_parent === true || acc.is_parent === 'true',
        suspended: acc.suspended === true || acc.suspended === 'true',
        parent_id: acc.parent_id ? parseInt(acc.parent_id) : null,
        lvl: parseInt(acc.lvl) || 1,
        coadate: acc.coadate || null,
      }));

      console.log(`[CoaForm] Loaded ${mappedAccounts.length} accounts`);

      setAccounts(mappedAccounts);
      setLastSync(new Date().toLocaleString('id-ID'));
      setSyncStatus(null);

    } catch (err: any) {
      console.error('[CoaForm] Error:', err);
      setError('Gagal memuat COA: ' + err.message);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }

  // ============================================
  // MANUAL SYNC FROM ACCURATE
  // ============================================
  async function handleManualSync() {
    if (!activeEntity) {
      setError('Tidak ada entitas yang aktif');
      return;
    }
    if (!activeEntity.api_token) {
      setError('API Token tidak ditemukan');
      return;
    }

    try {
      setSyncing(true);
      setError(null);
      setSyncStatus('Mengambil data COA dari Accurate API...');

      const result = await fetchCoaFromAccurate(activeEntity.id, activeEntity.api_token);

      if (!result.success) {
        throw new Error(result.error || 'Gagal mengambil data COA');
      }

      setSyncStatus('Data berhasil disimpan. Memuat dari database...');
      
      setTimeout(() => {
        loadCoaFromDatabase();
      }, 500);

      setSyncStatus(`Berhasil sync ${result.total} akun COA`);
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err: any) {
      console.error('[CoaForm] Error syncing:', err);
      setError('Gagal mengambil COA: ' + err.message);
      setSyncStatus(null);
    } finally {
      setSyncing(false);
    }
  }

  // ============================================
  // TOGGLE EXPAND/COLLAPSE
  // ============================================
  const toggleExpand = (accountId: number) => {
    setExpanded(prev => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  // ============================================
  // CHECK IF ACCOUNT VISIBLE
  // ============================================
  const isVisible = (account: CoaAccountExtended): boolean => {
    if (!account.parent_id) return true;
    
    const parent = accounts.find(a => a.id === account.parent_id);
    if (!parent) return true;
    
    return expanded[account.parent_id] === true && isVisible(parent);
  };

  // ============================================
  // GET DISPLAY BALANCE
  // ============================================
  const getDisplayBalance = (account: CoaAccountExtended): number => {
    if (account.is_parent) {
      return calculateTotalBalance(account.id, accounts);
    }
    return account.balance;
  };

  // ============================================
  // ✅ HANDLE EDIT - HANYA NAMA & KODE
  // ============================================
  const handleEdit = (account: CoaAccountExtended) => {
    console.log('[handleEdit] Editing account:', account);
    
    setEditingAccount(account);
    setEditForm({
      account_code: account.account_code,
      account_name: account.account_name,
    });
    
    setEditModalOpen(true);
  };

  // ============================================
  // ✅ SUBMIT EDIT - HANYA UPDATE NAMA & KODE
  // ============================================
  const handleEditSubmit = async () => {
    if (!activeEntity || !editingAccount) return;

    try {
      setEditLoading(true);
      setError(null);

      console.log('[handleEditSubmit] Starting edit...');
      console.log('[handleEditSubmit] Edit form:', editForm);

      // Call Edge Function (update Accurate API)
      const result = await editAccount(
        activeEntity.id,
        editingAccount.id,
        editForm
      );

      if (!result.success) {
        throw new Error(result.error || 'Gagal mengedit account');
      }

      console.log('[handleEditSubmit] ✅ Edge Function success');

      // Update database
      const { supabase } = await import('../lib/supabase');

      const dbUpdateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (editForm.account_code) {
        dbUpdateData.account_code = editForm.account_code;
      }
      if (editForm.account_name) {
        dbUpdateData.account_name = editForm.account_name;
      }

      console.log('[handleEditSubmit] 💾 Updating database:', dbUpdateData);

      const { error: dbError } = await supabase
        .from('accurate_accounts')
        .update(dbUpdateData)
        .eq('entity_id', activeEntity.id)
        .eq('accurate_id', String(editingAccount.id));

      if (dbError) {
        console.error('[handleEditSubmit] ❌ Database update error:', dbError);
        throw new Error(`Gagal update database: ${dbError.message}`);
      }

      console.log('[handleEditSubmit] ✅ Database updated successfully');

      setSyncStatus('✅ Account berhasil diupdate');
      setEditModalOpen(false);
      
      setTimeout(() => loadCoaFromDatabase(), 500);
      setTimeout(() => setSyncStatus(null), 3000);

    } catch (err: any) {
      console.error('[handleEditSubmit] ❌ Error:', err);
      setError('❌ Gagal mengedit: ' + err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // ============================================
  // HANDLE DELETE
  // ============================================
  const handleDelete = (account: CoaAccountExtended) => {
    setDeletingAccount(account);
    setDeleteModalOpen(true);
  };

  // ============================================
  // SUBMIT DELETE
  // ============================================
  const handleDeleteConfirm = async () => {
    if (!deletingAccount) return;
    
    setDeleteLoading(true);
    try {
      console.log('[handleDeleteConfirm] Deleting account db_id:', deletingAccount.db_id);
      
      const { error } = await deleteCoaAccount(deletingAccount.db_id);
      
      if (error) {
        throw new Error(error);
      }
      
      await loadCoaFromDatabase();
      setDeleteModalOpen(false);
      setSyncStatus('✅ Account berhasil dihapus!');
      setTimeout(() => setSyncStatus(null), 3000);
      
    } catch (err: any) {
      console.error('[handleDeleteConfirm] Error:', err);
      setError('❌ Gagal menghapus account: ' + err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ============================================
  // DELETE ALL ACCOUNTS
  // ============================================
  const handleDeleteAll = async () => {
    if (!activeEntity) return;

    setDeletingAll(true);
    try {
      console.log('[handleDeleteAll] Deleting all accounts for entity:', activeEntity.id);

      const { supabase } = await import('../lib/supabase');
      
      const { error } = await supabase
        .from('accurate_accounts')
        .delete()
        .eq('entity_id', activeEntity.id);

      if (error) {
        throw new Error(error.message);
      }

      const deletedCount = accounts.length;
      setShowFinalConfirmModal(false);
      setShowDeleteAllModal(false);
      setSyncStatus(`✅ Berhasil menghapus ${deletedCount} akun COA!`);
      
      await loadCoaFromDatabase();
      
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err: any) {
      console.error('[handleDeleteAll] Error:', err);
      setError('❌ Gagal menghapus semua COA: ' + err.message);
    } finally {
      setDeletingAll(false);
    }
  };

  // ============================================
  // INITIAL LOAD AND SUBSCRIPTION
  // ============================================
  useEffect(() => {
    if (!activeEntity?.id) {
      setAccounts([]);
      setError(null);
      setSyncStatus(null);
      setLastSync(null);
      return;
    }

    loadCoaFromDatabase();

    const subscription = subscribeAccounts(activeEntity.id, () => {
      console.log('[CoaForm] Real-time update detected');
      loadCoaFromDatabase();
      setSyncStatus('Data diperbarui via webhook!');
      setTimeout(() => setSyncStatus(null), 3000);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [activeEntity?.id]);

  // ============================================
  // RETURN ALL STATE AND HANDLERS
  // ============================================
  return {
    accounts,
    loading,
    syncing,
    error,
    syncStatus,
    lastSync,
    expanded,
    activeEntity,
    
    editModalOpen,
    editingAccount,
    editForm,
    editLoading,
    setEditForm,
    setEditModalOpen,
    
    deleteModalOpen,
    deletingAccount,
    deleteLoading,
    setDeleteModalOpen,
    
    showDeleteAllModal,
    showFinalConfirmModal,
    deletingAll,
    setShowDeleteAllModal,
    setShowFinalConfirmModal,
    
    loadCoaFromDatabase,
    handleManualSync,
    toggleExpand,
    isVisible,
    getDisplayBalance,
    handleEdit,
    handleEditSubmit,
    handleDelete,
    handleDeleteConfirm,
    handleDeleteAll,
  };
};