import React, { useEffect, useState } from 'react';
import { useEntity } from '../contexts/EntityContext';
import {
  fetchCoaFromAccurate,
  getLocalAccounts,
  subscribeAccounts,
  calculateTotalBalance,
  getChildAccounts,
  editAccount,
  deleteAccount,
  type CoaAccount,
  type EditAccountData,
} from '../lib/accurate';

interface ExpandedState {
  [accountId: number]: boolean;
}

const CoaPage: React.FC = () => {
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'database' | 'api'>('database');
  
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

  useEffect(() => {
    if (activeEntity?.accurate_database_id) {
      setWebhookEnabled(true);
    } else {
      setWebhookEnabled(false);
    }
  }, [activeEntity]);

  async function loadCoaFromDatabase() {
    if (!activeEntity?.id) {
      console.log('[CoaPage] No active entity');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[CoaPage] Loading COA from database');

      const { data, error: dbError } = await getLocalAccounts(activeEntity.id);

      if (dbError) {
        throw new Error(dbError.message);
      }

      if (!data || data.length === 0) {
        setAccounts([]);
        setDataSource('database');
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

      console.log(`[CoaPage] Loaded ${mappedAccounts.length} accounts`);

      setAccounts(mappedAccounts);
      setDataSource('database');
      setLastSync(new Date().toLocaleString('id-ID'));
      setSyncStatus(null);

    } catch (err: any) {
      console.error('[CoaPage] Error:', err);
      setError('Gagal memuat COA: ' + err.message);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }

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
      console.error('[CoaPage] Error syncing:', err);
      setError('Gagal mengambil COA: ' + err.message);
      setSyncStatus(null);
    } finally {
      setSyncing(false);
    }
  }

  // Toggle expand/collapse
  const toggleExpand = (accountId: number) => {
    setExpanded(prev => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  // Check if account should be visible (based on parent expand state)
  const isVisible = (account: CoaAccount): boolean => {
    if (!account.parent_id) return true; // Root level always visible
    
    const parent = accounts.find(a => a.id === account.parent_id);
    if (!parent) return true;
    
    // Parent must be expanded AND visible
    return expanded[account.parent_id] === true && isVisible(parent);
  };

  // Get display balance (total for parent, own balance for children)
  const getDisplayBalance = (account: CoaAccount): number => {
    if (account.is_parent) {
      return calculateTotalBalance(account.id, accounts);
    }
    return account.balance;
  };

  // Open edit modal
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
    
    console.log('[handleEdit] Edit form initialized:', {
      account_code: account.account_code,
      account_name: account.account_name,
      account_type: account.account_type,
      currencyCode: account.currency || 'IDR',
      asOf: formattedDate,
    });
    
    setEditModalOpen(true);
  };

  // Submit edit
  const handleEditSubmit = async () => {
    if (!activeEntity || !editingAccount) return;

    try {
      setEditLoading(true);
      setError(null);

      console.log('[handleEditSubmit] Submitting edit...');
      console.log('[handleEditSubmit] Entity ID:', activeEntity.id);
      console.log('[handleEditSubmit] Account ID:', editingAccount.id);
      console.log('[handleEditSubmit] Updates:', editForm);

      const result = await editAccount(
        activeEntity.id,
        editingAccount.id,
        editForm
      );

      console.log('[handleEditSubmit] Edit result:', result);

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

  // Open delete modal
  const handleDelete = (account: CoaAccount) => {
    setDeletingAccount(account);
    setDeleteModalOpen(true);
  };

  // Submit delete
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

  // Initial load and subscription
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
      console.log('[CoaPage] Real-time update detected');
      loadCoaFromDatabase();
      setSyncStatus('🔔 Data diperbarui via webhook!');
      setTimeout(() => setSyncStatus(null), 3000);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [activeEntity?.id]);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 600, margin: 0 }}>Chart of Accounts</h1>
            {activeEntity ? (
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '14px', color: '#6c757d' }}>
                  <strong>Entitas:</strong> {activeEntity.entity_name || activeEntity.name || 'Unknown'}
                </div>
                {webhookEnabled && (
                  <span style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '4px', fontWeight: 500 }}>
                    🔔 Webhook Active
                  </span>
                )}
                {lastSync && (
                  <span style={{ fontSize: '12px', color: '#6c757d' }}>
                    Last sync: {lastSync}
                  </span>
                )}
                <span style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: '#e7f3ff', color: '#004085', borderRadius: '4px' }}>
                  {dataSource === 'database' ? '💾 From Database' : '☁️ From API'}
                </span>
              </div>
            ) : (
              <div style={{ marginTop: '8px', color: '#dc3545', fontSize: '14px' }}>
                ⚠️ Tidak ada entitas yang aktif
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={loadCoaFromDatabase}
              disabled={loading || !activeEntity}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading || !activeEntity ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                opacity: loading || !activeEntity ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {loading ? (
                <>
                  <span style={{ animation: 'spin 1s linear infinite' }}>⟳</span>
                  Loading...
                </>
              ) : (
                <>🔄 Refresh dari Database</>
              )}
            </button>
            <button
              onClick={handleManualSync}
              disabled={syncing || !activeEntity}
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: syncing || !activeEntity ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                opacity: syncing || !activeEntity ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {syncing ? (
                <>
                  <span style={{ animation: 'spin 1s linear infinite' }}>⟳</span>
                  Syncing...
                </>
              ) : (
                <>☁️ Tarik dari Accurate</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* No Active Entity Warning */}
      {!activeEntity && (
        <div style={{ padding: '24px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#856404' }}>⚠️ Belum Ada Entitas Aktif</h3>
          <p style={{ margin: '0 0 16px 0', color: '#856404' }}>
            Silakan pilih entitas terlebih dahulu di halaman Manajemen Entitas
          </p>
          <button
            onClick={() => window.location.href = '/entities'}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ffc107',
              color: '#212529',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Ke Halaman Entitas →
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div style={{ padding: '16px', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '6px', marginBottom: '20px', color: '#721c24' }}>
          Error: {error}
        </div>
      )}

      {/* Sync Status Alert */}
      {syncStatus && (
        <div style={{ padding: '16px', backgroundColor: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '6px', marginBottom: '20px', color: '#155724' }}>
          {syncStatus}
        </div>
      )}

      {/* COA Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={tableHeaderStyle}>Kode Akun</th>
                <th style={tableHeaderStyle}>Nama Akun</th>
                <th style={tableHeaderStyle}>Tipe</th>
                <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Saldo</th>
                <th style={tableHeaderStyle}>Status</th>
                <th style={{ ...tableHeaderStyle, width: '100px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ ...tableCellStyle, textAlign: 'center', padding: '40px' }}>
                    ⏳ Memuat data COA...
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...tableCellStyle, textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                    📋 Belum ada data COA.{' '}
                    {activeEntity
                      ? 'Klik tombol "Tarik dari Accurate" untuk mengambil data.'
                      : 'Pilih entitas terlebih dahulu.'}
                  </td>
                </tr>
              ) : (
                accounts.filter(isVisible).map((acc) => (
                  <tr key={acc.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ ...tableCellStyle, fontFamily: 'monospace' }}>
                      {acc.account_code}
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Indent based on level */}
                        <span style={{ marginLeft: `${(acc.lvl - 1) * 24}px` }} />
                        
                        {/* Expand/collapse icon for parents */}
                        {acc.is_parent && (
                          <button
                            onClick={() => toggleExpand(acc.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '16px',
                              padding: '0 4px',
                            }}
                          >
                            {expanded[acc.id] ? '▼' : '▶'}
                          </button>
                        )}
                        
                        {/* Parent icon */}
                        {acc.is_parent && <span>📁</span>}
                        
                        {/* Account name */}
                        <span style={{ fontWeight: acc.is_parent ? 600 : 400 }}>
                          {acc.account_name}
                        </span>
                      </div>
                    </td>
                    <td style={tableCellStyle}>
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: '#e7f3ff',
                        color: '#004085',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}>
                        {acc.account_type_name}
                      </span>
                    </td>
                    <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                      <span style={{
                        fontFamily: 'monospace',
                        fontWeight: acc.is_parent ? 600 : 400,
                      }}>
                        {acc.currency} {getDisplayBalance(acc).toLocaleString('id-ID')}
                      </span>
                      {acc.is_parent && (
                        <span style={{ fontSize: '11px', color: '#6c757d', marginLeft: '4px' }}>
                          (total)
                        </span>
                      )}
                    </td>
                    <td style={tableCellStyle}>
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: !acc.suspended ? '#d4edda' : '#f8d7da',
                        color: !acc.suspended ? '#155724' : '#721c24',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}>
                        {!acc.suspended ? '✓ Aktif' : '✗ Suspended'}
                      </span>
                    </td>
                    <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleEdit(acc)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(acc)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {accounts.length > 0 && (
          <div style={{ padding: '16px', backgroundColor: '#f8f9fa', borderTop: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#6c757d' }}>
            <div>
              <strong>Total: {accounts.length}</strong> akun COA
            </div>
            <div>
              {accounts.filter((a) => !a.suspended).length} aktif,{' '}
              {accounts.filter((a) => a.suspended).length} suspended
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
          }}>
            <h3 style={{ margin: '0 0 16px 0' }}>Edit Account</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
                Kode Akun
              </label>
              <input
                type="text"
                value={editForm.account_code || ''}
                onChange={(e) => setEditForm({ ...editForm, account_code: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
                Nama Akun
              </label>
              <input
                type="text"
                value={editForm.account_name || ''}
                onChange={(e) => setEditForm({ ...editForm, account_name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
                Tipe Akun
              </label>
              <select
                value={editForm.account_type || ''}
                onChange={(e) => setEditForm({ ...editForm, account_type: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                <option value="ASSET">ASSET</option>
                <option value="LIABILITY">LIABILITY</option>
                <option value="EQUITY">EQUITY</option>
                <option value="REVENUE">REVENUE</option>
                <option value="EXPENSE">EXPENSE</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={handleEditSubmit}
                disabled={editLoading}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: editLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  opacity: editLoading ? 0.6 : 1,
                }}
              >
                {editLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button
                onClick={() => setEditModalOpen(false)}
                disabled={editLoading}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: editLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%',
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#dc3545' }}>⚠️ Konfirmasi Hapus</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px' }}>
              Apakah Anda yakin ingin menghapus account berikut?
            </p>
            <div style={{
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              marginBottom: '16px',
            }}>
              <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                <strong>Kode:</strong> {deletingAccount?.account_code}
              </div>
              <div style={{ fontSize: '14px' }}>
                <strong>Nama:</strong> {deletingAccount?.account_name}
              </div>
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6c757d' }}>
              ⚠️ Account akan dihapus dari Accurate dan database lokal.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  opacity: deleteLoading ? 0.6 : 1,
                }}
              >
                {deleteLoading ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleteLoading}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        table tbody tr:hover {
          background-color: #f8f9fa;
        }
      `}</style>
    </div>
  );
};

const tableHeaderStyle: React.CSSProperties = {
  padding: '14px 16px',
  textAlign: 'left',
  fontSize: '13px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#495057',
  borderBottom: '2px solid #dee2e6',
};

const tableCellStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: '14px',
  color: '#212529',
};

export default CoaPage;