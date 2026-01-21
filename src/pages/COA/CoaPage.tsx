// COAPage.tsx - Updated with Global Table Styles
import React, { useState, useRef, useEffect } from 'react';
import { useCoaForm } from '../../components/CoaForm';
import { ImportExcel } from '../../components/Export&Import/ImportExcel';
import styles from './COAPage.module.css';

const CoaPage: React.FC = () => {
  const {
    accounts,
    loading,
    syncing,
    error,
    syncStatus,
    activeEntity,
    editModalOpen,
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
  const [successMessage, setSuccessMessage] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleImportSuccess = () => {
    loadCoaFromDatabase();
  };

  const handleImportError = (message: string) => {
    console.error('Import error:', message);
  };

  // Handle refresh with success message
  const handleRefresh = async () => {
    await loadCoaFromDatabase();
    setSuccessMessage('✓ Data COA berhasil di-refresh!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.headerTitle}>Chart of Accounts</h1>
          <p className={styles.headerSubtitle}>
            Kelola Chart of Accounts dari Accurate Online atau Import dari Excel
          </p>
        </div>
      </div>

      {/* No Active Entity Warning */}
      {!activeEntity && (
        <div className={styles.noEntityWarning}>
          <h3 className={styles.noEntityWarningTitle}>Belum Ada Entitas Aktif</h3>
          <p className={styles.noEntityWarningText}>
            Silakan pilih entitas terlebih dahulu di halaman Manajemen Entitas
          </p>
          <button
            onClick={() => window.location.href = '/entities'}
            className={styles.noEntityWarningButton}
          >
            Ke Halaman Entitas →
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && <div className={styles.errorAlert}>{error}</div>}

      {/* Success Alert */}
      {successMessage && (
        <div className={styles.successAlert}>
          <span>✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Sync Status Alert */}
      {syncStatus && <div className={styles.syncStatusAlert}>{syncStatus}</div>}

      {/* COA Card */}
      <div className={styles.coaCard}>
        {/* Card Header */}
        <div className={styles.cardHeader}>
          <h3 className={styles.cardHeaderTitle}>Daftar Akun</h3>
          <div className={styles.cardHeaderActions}>
            <button
              onClick={handleRefresh}
              disabled={loading || !activeEntity}
              className={styles.refreshButton}
            >
              {loading ? (
                <>
                  <span className={styles.refreshButtonSpinner}>⟳</span>
                  Loading...
                </>
              ) : (
                <>Refresh</>
              )}
            </button>

            <div className={styles.dropdownContainer} ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                disabled={!activeEntity || syncing}
                className={styles.dropdownButton}
              >
                <span>Import Data</span>
                <span className={styles.dropdownArrow}>▼</span>
              </button>

              {dropdownOpen && (
                <div className={styles.dropdownMenu}>
                  <button
                    onClick={() => {
                      handleManualSync();
                      setDropdownOpen(false);
                    }}
                    disabled={syncing}
                    className={styles.dropdownMenuItem}
                  >
                    <span className={styles.dropdownMenuIcon}>🔗</span>
                    <span>Tarik dari Accurate API</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowImportExcel(true);
                      setDropdownOpen(false);
                    }}
                    className={styles.dropdownMenuItem}
                  >
                    <span className={styles.dropdownMenuIcon}>📊</span>
                    <span>Import dari Excel</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table - PAKAI GLOBAL STYLES */}
        <div className="table-container">
          <table className="shared-table">
            <thead>
              <tr>
                <th>Kode Akun</th>
                <th>Nama Akun</th>
                <th>Tipe</th>
                <th className={styles.tableHeaderCellRight}>Saldo</th>
                <th>Status</th>
                <th className={styles.tableHeaderCellCenter}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="table-loading">
                    Memuat data COA...
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    Belum ada data COA.{' '}
                    {activeEntity
                      ? 'Gunakan tombol "Import Data" untuk mengambil data dari Accurate atau Excel.'
                      : 'Pilih entitas terlebih dahulu.'}
                  </td>
                </tr>
              ) : (
                accounts.filter(isVisible).map((acc) => (
                  <tr key={acc.db_id}>
                    {/* KODE AKUN */}
                    <td className="table-cell-monospace">
                      <div className={styles.tableCellIndent}>
                        <span style={{ marginLeft: `${(acc.lvl - 1) * 24}px` }} />
                        {acc.account_code}
                      </div>
                    </td>
                    
                    {/* NAMA AKUN */}
                    <td>
                      <div className={styles.tableCellIndent}>
                        <span style={{ marginLeft: `${(acc.lvl - 1) * 24}px` }} />
                        {acc.account_name}
                      </div>
                    </td>
                    
                    {/* TIPE */}
                    <td>
                      <span className={styles.accountTypeBadge}>
                        {acc.account_type_name}
                      </span>
                    </td>

                    {/* SALDO */}
                    <td className="table-cell-right">
                      <span className="table-cell-monospace">
                        {acc.currency} {getDisplayBalance(acc).toLocaleString('id-ID')}
                      </span>
                    </td>

                    {/* STATUS */}
                    <td>
                      <span className={!acc.suspended ? styles.statusBadgeActive : styles.statusBadgeSuspended}>
                        {!acc.suspended ? '✓ Aktif' : '✗ Suspended'}
                      </span>
                    </td>

                    {/* ACTIONS */}
                    <td className="table-cell-center">
                      <div className="table-actions">
                        <button
                          onClick={() => handleEdit(acc)}
                          className={styles.editButton}
                          title="Edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(acc)}
                          className={styles.deleteButton}
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

        {/* Footer */}
        {accounts.length > 0 && (
          <div className={styles.cardFooter}>
            <div>
              {accounts.filter((a) => !a.suspended).length} aktif
            </div>
            <button
              onClick={() => setShowDeleteAllModal(true)}
              className={styles.deleteAllButton}
            >
              Delete All COA
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
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Edit Account</h3>
            
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Kode Akun</label>
              <input
                type="text"
                value={editForm.account_code || ''}
                onChange={(e) => setEditForm({ ...editForm, account_code: e.target.value })}
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nama Akun</label>
              <input
                type="text"
                value={editForm.account_name || ''}
                onChange={(e) => setEditForm({ ...editForm, account_name: e.target.value })}
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tipe Akun</label>
              <select
                value={editForm.account_type || ''}
                onChange={(e) => setEditForm({ ...editForm, account_type: e.target.value })}
                className={styles.formSelect}
              >
                <option value="ASSET">ASSET</option>
                <option value="LIABILITY">LIABILITY</option>
                <option value="EQUITY">EQUITY</option>
                <option value="REVENUE">REVENUE</option>
                <option value="EXPENSE">EXPENSE</option>
              </select>
            </div>

            <div className={styles.modalButtonGroup}>
              <button
                onClick={handleEditSubmit}
                disabled={editLoading}
                className={styles.modalButtonPrimary}
              >
                {editLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button
                onClick={() => setEditModalOpen(false)}
                disabled={editLoading}
                className={styles.modalButtonSecondary}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} ${styles.modalContentSmall}`}>
            <h3 className={`${styles.modalTitle} ${styles.modalTitleDanger}`}>Konfirmasi Hapus</h3>
            <p className={styles.modalText}>
              Apakah Anda yakin ingin menghapus account berikut?
            </p>
            <div className={styles.accountInfoBox}>
              <div className={styles.accountInfoItem}>
                <strong>Kode:</strong> {deletingAccount?.account_code}
              </div>
              <div className={styles.accountInfoItem}>
                <strong>Nama:</strong> {deletingAccount?.account_name}
              </div>
            </div>

            <div className={styles.modalButtonGroup}>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className={styles.modalButtonDanger}
              >
                {deleteLoading ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleteLoading}
                className={styles.modalButtonSecondary}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: First Warning - Delete All */}
      {showDeleteAllModal && (
        <div className={styles.modalOverlayDeleteAll}>
          <div className={styles.modalContentLarge}>
            <h3 className={`${styles.modalTitle} ${styles.modalTitleDanger} ${styles.modalTitleCenter}`}>
              PERINGATAN!
            </h3>
            <p className={styles.modalTextCenter}>
              Anda akan menghapus <strong style={{ color: '#dc3545' }}>SEMUA {accounts.length} akun COA</strong>
            </p>
            <div className={styles.modalWarningBox}>
              <p className={styles.modalWarningText}>
                <strong>Tindakan ini TIDAK DAPAT dibatalkan!</strong><br/>
                Semua data Chart of Accounts akan dihapus secara permanen dari database.
              </p>
            </div>
            <p className={`${styles.modalTextCenter} ${styles.modalTextCenterBold}`}>
              Apakah Anda yakin ingin melanjutkan?
            </p>
            <div className={styles.modalButtonGroup}>
              <button
                onClick={() => setShowDeleteAllModal(false)}
                className={styles.modalButtonSecondary}
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setShowDeleteAllModal(false);
                  setShowFinalConfirmModal(true);
                }}
                className={styles.modalButtonWarning}
              >
                Ya, Saya Yakin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Final Confirmation - Delete All */}
      {showFinalConfirmModal && (
        <div className={styles.modalOverlayFinalConfirm}>
          <div className={`${styles.modalContentLarge} ${styles.modalContentDanger}`}>
            <h3 className={`${styles.modalTitle} ${styles.modalTitleDanger} ${styles.modalTitleCenterBold}`}>
              KONFIRMASI AKHIR
            </h3>
            <div className={styles.modalWarningBoxDanger}>
              <p className={styles.modalWarningTextDanger}>
                Ini adalah kesempatan TERAKHIR Anda!<br/>
                <strong style={{ fontSize: '17px' }}>{accounts.length} akun COA</strong> akan dihapus SELAMANYA!
              </p>
            </div>
            <p className={`${styles.modalTextCenter} ${styles.modalTextGray}`}>
              Klik tombol "HAPUS SEMUA" di bawah untuk melanjutkan penghapusan.
            </p>
            <div className={styles.modalButtonGroup}>
              <button
                onClick={() => setShowFinalConfirmModal(false)}
                disabled={deletingAll}
                className={styles.modalButtonSuccess}
              >
                ✓ Batalkan
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className={styles.modalButtonDangerLarge}
              >
                {deletingAll ? '⟳ Menghapus...' : ' HAPUS SEMUA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoaPage;