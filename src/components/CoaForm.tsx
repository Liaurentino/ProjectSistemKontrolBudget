// CoaForm.tsx - Custom Hook for COA Logic
import { useEffect, useState } from 'react';
import { useEntity } from '../contexts/EntityContext';
import {
  fetchCoaFromAccurate,
  getLocalAccounts,
  subscribeAccounts,
  calculateTotalBalance,
  editAccount,
  deleteAccount,
  type CoaAccount,
  type EditAccountData,
} from '../lib/accurate';

interface ExpandedState {
  [accountId: number]: boolean;
}

export const useCoaForm = () => {
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  
  // Expand/collapse state
  const [expanded, setExpanded] = useState<ExpandedState>({});
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CoaAccount | null>(null);
  const [editForm, setEditForm] = useState<EditAccountData>({});
  const [editLoading, setEditLoading] = useState(false);
  
  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<CoaAccount | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
        setSyncStatus('ℹ️ Belum ada data COA. Klik "Tarik dari Accurate" untuk sync.');
        return;
      }

      const mappedAccounts: CoaAccount[] = data.map((acc: any) => ({
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
      setSyncStatus('🔄 Mengambil data COA dari Accurate API...');

      const result = await fetchCoaFromAccurate(activeEntity.id, activeEntity.api_token);

      if (!result.success) {
        throw new Error(result.error || 'Gagal mengambil data COA');
      }

      setSyncStatus('✅ Data berhasil disimpan. Memuat dari database...');
      
      setTimeout(() => {
        loadCoaFromDatabase();
      }, 500);

      setSyncStatus(`✅ Berhasil sync ${result.total} akun COA`);
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
  const isVisible = (account: CoaAccount): boolean => {
    if (!account.parent_id) return true; // Root level always visible
    
    const parent = accounts.find(a => a.id === account.parent_id);
    if (!parent) return true;
    
    // Parent must be expanded AND visible
    return expanded[account.parent_id] === true && isVisible(parent);
  };

  // ============================================
  // GET DISPLAY BALANCE
  // ============================================
  const getDisplayBalance = (account: CoaAccount): number => {
    if (account.is_parent) {
      return calculateTotalBalance(account.id, accounts);
    }
    return account.balance;
  };

  // ============================================
  // HANDLE EDIT
  // ============================================
  const handleEdit = (account: CoaAccount) => {
    console.log('[handleEdit] Editing account:', account);
    setEditingAccount(account);
    
    // Format date as DD/MM/YYYY
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    
    setEditForm({
      account_code: account.account_code,
      account_name: account.account_name,
      account_type: account.account_type,
      currencyCode: account.currency || 'IDR',
      asOf: formattedDate,
    });
    
    setEditModalOpen(true);
  };

  // ============================================
  // SUBMIT EDIT
  // ============================================
  const handleEditSubmit = async () => {
    if (!activeEntity || !editingAccount) return;

    try {
      setEditLoading(true);
      setError(null);

      console.log('[handleEditSubmit] Submitting edit...');

      const result = await editAccount(
        activeEntity.id,
        editingAccount.id,
        editForm
      );

      if (!result.success) {
        throw new Error(result.error || 'Gagal mengedit account');
      }

      setSyncStatus('✅ Account berhasil diupdate');
      setEditModalOpen(false);
      
      // Reload data
      setTimeout(() => loadCoaFromDatabase(), 500);
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err: any) {
      console.error('[handleEditSubmit] Error:', err);
      setError('Gagal mengedit: ' + err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // ============================================
  // HANDLE DELETE
  // ============================================
  const handleDelete = (account: CoaAccount) => {
    setDeletingAccount(account);
    setDeleteModalOpen(true);
  };

  // ============================================
  // SUBMIT DELETE
  // ============================================
  const handleDeleteConfirm = async () => {
    if (!activeEntity || !deletingAccount) return;

    try {
      setDeleteLoading(true);
      setError(null);

      const result = await deleteAccount(activeEntity.id, deletingAccount.id);

      if (!result.success) {
        if (result.hasChildren) {
          // Show children warning
          const childNames = result.children?.map((c: any) => c.account_name).join(', ');
          setError(`Tidak dapat menghapus account yang memiliki children: ${childNames}`);
          setDeleteModalOpen(false);
          return;
        }
        throw new Error(result.error || 'Gagal menghapus account');
      }

      setSyncStatus('✅ Account berhasil dihapus');
      setDeleteModalOpen(false);
      
      // Reload data
      setTimeout(() => loadCoaFromDatabase(), 500);
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err: any) {
      setError('Gagal menghapus: ' + err.message);
    } finally {
      setDeleteLoading(false);
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
      setSyncStatus('🔔 Data diperbarui via webhook!');
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
    // State
    accounts,
    loading,
    syncing,
    error,
    syncStatus,
    lastSync,
    expanded,
    activeEntity,
    
    // Edit Modal State
    editModalOpen,
    editingAccount,
    editForm,
    editLoading,
    setEditForm,
    setEditModalOpen,
    
    // Delete Modal State
    deleteModalOpen,
    deletingAccount,
    deleteLoading,
    setDeleteModalOpen,
    
    // Handlers
    loadCoaFromDatabase,
    handleManualSync,
    toggleExpand,
    isVisible,
    getDisplayBalance,
    handleEdit,
    handleEditSubmit,
    handleDelete,
    handleDeleteConfirm,
  };
};