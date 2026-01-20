// COAPage.tsx - Complete Version
import React, { useState, useRef, useEffect } from 'react';
import { useCoaForm } from '../components/CoaForm';
import { ImportExcel } from '../components/ImportExcel';

const CoaPage: React.FC = () => {
  const {
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
    
    // Delete All Modal State
    showDeleteAllModal,
    showFinalConfirmModal,
    deletingAll,
    setShowDeleteAllModal,
    setShowFinalConfirmModal,
    
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
    handleDeleteAll,
  } = useCoaForm();

  const [showImportExcel, setShowImportExcel] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Handle import success
  const handleImportSuccess = () => {
    loadCoaFromDatabase();
  };

  // Handle import error
  const handleImportError = (message: string) => {
    console.error('Import error:', message);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 600, margin: 0 }}>Chart of Accounts</h1>
          <p style={{ margin: '8px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
            Kelola Chart of Accounts dari Accurate Online atau Import dari Excel
          </p>
        </div>
      </div>

      {/* No Active Entity Warning */}
      {!activeEntity && (
        <div style={{ padding: '24px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#856404' }}>Belum Ada Entitas Aktif</h3>
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
          {error}
        </div>
      )}

      {/* Sync Status Alert */}
      {syncStatus && (
        <div style={{ padding: '16px', backgroundColor: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '6px', marginBottom: '20px', color: '#155724' }}>
          {syncStatus}
        </div>
      )}

      {/* COA Card */}
      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        {/* Card Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Daftar Akun</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            {/* Refresh Button */}
            <button
              onClick={loadCoaFromDatabase}
              disabled={loading || !activeEntity}
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
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
                <>🔄 Refresh</>
              )}
            </button>

            {/* Dropdown Import Button */}
            <div style={{ position: 'relative', display: 'inline-block' }} ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                disabled={!activeEntity || syncing}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: !activeEntity || syncing ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  opacity: !activeEntity || syncing ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (activeEntity && !syncing) {
                    e.currentTarget.style.backgroundColor = '#0056b3';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#007bff';
                }}
              >
                <span>📥</span>
                <span>Import Data</span>
                <span style={{ marginLeft: '4px' }}>▼</span>
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    minWidth: '220px',
                    zIndex: 1000,
                    overflow: 'hidden',
                  }}
                >
                  {/* Option 1: Tarik dari Accurate */}
                  <button
                    onClick={() => {
                      handleManualSync();
                      setDropdownOpen(false);
                    }}
                    disabled={syncing}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      backgroundColor: 'white',
                      border: 'none',
                      borderBottom: '1px solid #f0f0f0',
                      textAlign: 'left',
                      cursor: syncing ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'background-color 0.2s',
                      opacity: syncing ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!syncing) {
                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>🔗</span>
                    <span>Tarik dari Accurate API</span>
                  </button>

                  {/* Option 2: Import dari Excel */}
                  <button
                    onClick={() => {
                      setShowImportExcel(true);
                      setDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      backgroundColor: 'white',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>📊</span>
                    <span>Import dari Excel</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
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
                    Memuat data COA...
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...tableCellStyle, textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                    Belum ada data COA.{' '}
                    {activeEntity
                      ? 'Gunakan tombol "Import Data" untuk mengambil data dari Accurate atau Excel.'
                      : 'Pilih entitas terlebih dahulu.'}
                  </td>
                </tr>
              ) : (
                accounts.filter(isVisible).map((acc) => (
                  <tr key={acc.db_id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    {/* KODE AKUN */}
                    <td style={{ ...tableCellStyle, fontFamily: 'monospace' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ marginLeft: `${(acc.lvl - 1) * 24}px` }} />
                        {acc.account_code}
                      </div>
                    </td>
                    
                    {/* NAMA AKUN */}
                    <td style={tableCellStyle}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ marginLeft: `${(acc.lvl - 1) * 24}px` }} />
                        {acc.account_name}
                      </div>
                    </td>
                    
                    {/* TIPE */}
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

                    {/* SALDO */}
                    <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                      <span style={{ fontFamily: 'monospace' }}>
                        {acc.currency} {getDisplayBalance(acc).toLocaleString('id-ID')}
                      </span>
                    </td>

                    {/* STATUS */}
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

                    {/* ACTIONS */}
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
                          Edit
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
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer dengan Delete All Button */}
        {accounts.length > 0 && (
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#f8f9fa', 
            borderTop: '1px solid #dee2e6', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            fontSize: '14px', 
            color: '#6c757d' 
          }}>
            <div>
              {accounts.filter((a) => !a.suspended).length} aktif
            </div>
            
            {/* Delete All Button */}
            <button
              onClick={() => setShowDeleteAllModal(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#c82333';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#dc3545';
              }}
            >
              🗑️ Delete All COA
            </button>
          </div>
        )}
      </div>

      {/* Import Excel Modal */}
      {showImportExcel && activeEntity && (
        <ImportExcel
          entityId={activeEntity.id}
          onSuccess={() => {
            handleImportSuccess();
            setShowImportExcel(false);
          }}
          onError={handleImportError}
          onClose={() => setShowImportExcel(false)}
        />
      )}

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
            <h3 style={{ margin: '0 0 16px 0', color: '#dc3545' }}>Konfirmasi Hapus</h3>
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

      {/* MODAL 1: First Warning - Delete All */}
      {showDeleteAllModal && (
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
          zIndex: 1001,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            {/* Icon Warning */}
            <div style={{ 
              textAlign: 'center', 
              fontSize: '64px', 
              marginBottom: '16px' 
            }}>
              ⚠️
            </div>

            <h3 style={{ 
              margin: '0 0 16px 0', 
              color: '#dc3545', 
              textAlign: 'center',
              fontSize: '24px',
              fontWeight: 600,
            }}>
              Peringatan!
            </h3>
            
            <p style={{ 
              margin: '0 0 16px 0', 
              fontSize: '15px',
              textAlign: 'center',
              lineHeight: '1.6',
            }}>
              Anda akan menghapus <strong style={{ color: '#dc3545' }}>SEMUA {accounts.length} akun COA</strong> dari database.
            </p>

            <div style={{
              padding: '16px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '8px',
              marginBottom: '24px',
            }}>
              <p style={{ 
                margin: 0, 
                fontSize: '14px', 
                color: '#856404',
                lineHeight: '1.6',
              }}>
                <strong>⚠️ Tindakan ini TIDAK DAPAT dibatalkan!</strong><br/>
                Semua data Chart of Accounts akan dihapus secara permanen dari database.
              </p>
            </div>

            <p style={{ 
              margin: '0 0 24px 0', 
              fontSize: '14px',
              textAlign: 'center',
              fontWeight: 500,
            }}>
              Apakah Anda yakin ingin melanjutkan?
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowDeleteAllModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: 600,
                }}
              >
                Batal
              </button>
              
              <button
                onClick={() => {
                  setShowDeleteAllModal(false);
                  setShowFinalConfirmModal(true);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#ffc107',
                  color: '#212529',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: 600,
                }}
              >
                Ya, Saya Yakin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Final Confirmation - Delete All */}
      {showFinalConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1002,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            border: '3px solid #dc3545',
          }}>
            {/* Icon Danger */}
            <div style={{ 
              textAlign: 'center', 
              fontSize: '64px', 
              marginBottom: '16px' 
            }}>
              🚨
            </div>

            <h3 style={{ 
              margin: '0 0 16px 0', 
              color: '#dc3545', 
              textAlign: 'center',
              fontSize: '24px',
              fontWeight: 700,
            }}>
              KONFIRMASI AKHIR
            </h3>
            
            <div style={{
              padding: '20px',
              backgroundColor: '#f8d7da',
              border: '2px solid #dc3545',
              borderRadius: '8px',
              marginBottom: '24px',
            }}>
              <p style={{ 
                margin: 0, 
                fontSize: '15px', 
                color: '#721c24',
                textAlign: 'center',
                fontWeight: 600,
                lineHeight: '1.6',
              }}>
                Ini adalah kesempatan TERAKHIR Anda!<br/>
                <strong style={{ fontSize: '17px' }}>{accounts.length} akun COA</strong> akan dihapus SELAMANYA!
              </p>
            </div>

            <p style={{ 
              margin: '0 0 24px 0', 
              fontSize: '14px',
              textAlign: 'center',
              color: '#6c757d',
            }}>
              Klik tombol "HAPUS SEMUA" di bawah untuk melanjutkan penghapusan.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowFinalConfirmModal(false)}
                disabled={deletingAll}
                style={{
                  flex: 1,
                  padding: '14px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: deletingAll ? 'not-allowed' : 'pointer',
                  fontSize: '15px',
                  fontWeight: 600,
                }}
              >
                ✓ Batalkan
              </button>
              
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                style={{
                  flex: 1,
                  padding: '14px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: deletingAll ? 'not-allowed' : 'pointer',
                  fontSize: '15px',
                  fontWeight: 700,
                  opacity: deletingAll ? 0.6 : 1,
                }}
              >
                {deletingAll ? '⟳ Menghapus...' : '🗑️ HAPUS SEMUA'}
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
  borderRight: '1px solid #dee2e6',
};

const tableCellStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: '14px',
  color: '#212529',
  borderRight: '1px solid #dee2e6',
};

export default CoaPage;