import React, { useEffect, useState } from 'react';
import { getEntities, deleteEntity, updateEntityPrivacy } from '../../lib/supabase';
import { EntitasForm } from '../../components/EntitasForm/EntitasForm';
import { AccurateGuide } from '../../components/AccurateGuide/AccurateGuide';
import { useEntity } from '../../contexts/EntityContext';
import { validateEntitasToken } from '../../lib/accurate';
import type { AccurateValidationResult } from '../../lib/accurate';
import styles from './EntitasModule.module.css';

export const EntitasPage: React.FC = () => {
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);

  // Entity status states
  const [entityStatus, setEntityStatus] = useState<Record<string, AccurateValidationResult>>({});

  const { setActiveEntity, isEntityActive, setEntities: setContextEntities } = useEntity();

  /**
   * Helper function untuk mendapatkan error message
   */
  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return String(error);
  };

  /**
   * Fetch entitas dari Supabase
   */
  const fetchEntities = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await getEntities();
      if (err) {
        const errorMessage = getErrorMessage(err);
        throw new Error(errorMessage);
      }
      setEntities(data || []);
      setContextEntities(data || []); // Update context
    } catch (err) {
      setError(getErrorMessage(err));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check status koneksi setiap entitas
   */
  const checkEntityStatus = async (entity: any) => {
    if (!entity.api_token) {
      setEntityStatus((prev) => ({
        ...prev,
        [entity.id]: {
          isValid: false,
          message: 'Belum ada token',
        },
      }));
      return;
    }

    try {
      const result = await validateEntitasToken(entity.api_token);
      setEntityStatus((prev) => ({
        ...prev,
        [entity.id]: result,
      }));
    } catch (err) {
      setEntityStatus((prev) => ({
        ...prev,
        [entity.id]: {
          isValid: false,
          message: 'Gagal cek koneksi',
        },
      }));
    }
  };

  /**
   * Check status semua entitas
   */
  const checkAllStatus = async () => {
    setRefreshing(true);
    try {
      for (const entity of entities) {
        await checkEntityStatus(entity);
      }
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Handle delete entity
   */
  const handleDeleteEntity = async (id: string, name: string) => {
    if (!confirm(`Yakin ingin menghapus entitas "${name}"?`)) return;

    setLoading(true);
    try {
      const { error: err } = await deleteEntity(id);
      if (err) {
        const errorMessage = getErrorMessage(err);
        throw new Error(errorMessage);
      }
      
      // Jika entity yang dihapus adalah active entity, clear selection
      if (isEntityActive(id)) {
        setActiveEntity(null);
      }
      
      await fetchEntities();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle toggle privacy
   */
  const handleTogglePrivacy = async (entityId: string, currentStatus: boolean) => {
    setLoading(true);
    try {
      const { error: err } = await updateEntityPrivacy(entityId, !currentStatus);
      if (err) {
        throw new Error(err);
      }
      
      await fetchEntities(); // Refresh list
    } catch (err) {
      setError('Gagal update privacy: ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchEntities();
  }, []);

  // Check status ketika entities berubah
  useEffect(() => {
    if (entities.length > 0) {
      entities.forEach((entity) => {
        if (!entityStatus[entity.id]) {
          checkEntityStatus(entity);
        }
      });
    }
  }, [entities]);

  return (
    <div className="app-container fade-in">
      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1>Manajemen Entitas</h1>
          <p>Kelola koneksi entitas perusahaan Anda dengan Accurate</p>
        </div>
        
        {/* TOMBOL PANDUAN */}
        <div className={styles.headerActions}>
          <AccurateGuide />
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className={styles.errorAlert}>
          Error: {error}
        </div>
      )}

      {/* CARD */}
      <div className="card fade-in">
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Daftar Entitas</h3>
          <button
            className={`btn btn-sm btn-secondary ${styles.refreshButton}`}
            onClick={checkAllStatus}
            disabled={refreshing || loading}
          >
            {refreshing ? 'Refresh...' : 'Cek Status'}
          </button>
        </div>

        {/* BUTTON TAMBAH */}
        {!showForm && (
          <button
            className="btn btn-primary mb-3"
            onClick={() => setShowForm(true)}
            disabled={loading}
          >
            + Tambah Entitas Baru
          </button>
        )}

        {/* FORM TAMBAH */}
        {showForm && (
          <div className={styles.formContainer}>
            <EntitasForm
              mode="create"
              onSuccess={() => {
                setShowForm(false);
                fetchEntities();
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {/* FORM EDIT */}
        {showEdit && selectedEntity && (
          <EntitasForm
            mode="edit"
            initialData={selectedEntity}
            onCancel={() => {
              setShowEdit(false);
              setSelectedEntity(null);
            }}
            onSuccess={() => {
              setShowEdit(false);
              setSelectedEntity(null);
              fetchEntities();
            }}
          />
        )}

        {/* TABLE - PAKAI GLOBAL STYLES */}
        <div className="table-container">
          <table className="shared-table">
            <thead>
              <tr>
                <th className={styles.colActive}>Aktif</th>
                <th>Nama Entitas</th>
                <th>Koneksi Accurate</th>
                <th>Data Usaha Accurate</th>
                <th className={styles.colPrivacy}>Privacy</th>
                <th className={styles.colActions}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && entities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-loading">
                    Memuat data...
                  </td>
                </tr>
              ) : entities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    Belum ada entitas. Silakan tambahkan entitas baru untuk memulai.
                  </td>
                </tr>
              ) : (
                entities.map((e) => {
                  const status = entityStatus[e.id];
                  const isConnected = status?.isValid;
                  const statusText = isConnected ? '✓ Terhubung' : '✗ Tidak Terhubung';

                  return (
                    <tr key={e.id}>
                      {/* AKTIF - RADIO */}
                      <td className="table-cell-center">
                        <input
                          type="radio"
                          name="active-entity"
                          className={styles.radioInput}
                          checked={isEntityActive(e.id)}
                          onChange={() => setActiveEntity(e.id)}
                          disabled={loading}
                        />
                      </td>

                      {/* NAMA ENTITAS */}
                      <td className={styles.cellEntityName}>{e.entity_name}</td>

                      {/* STATUS KONEKSI */}
                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            isConnected ? styles.statusConnected : styles.statusDisconnected
                          }`}
                        >
                          {statusText}
                        </span>
                      </td>
 
                      {/* DATABASE */}
                      <td className={styles.cellDatabase}>
                        {status?.primaryDatabase ? (
                          <div className={styles.databaseInfo}>
                            <div className={styles.databaseName}>
                              {status.primaryDatabase.name}
                            </div>
                            <code className={styles.databaseId}>
                              {status?.primaryDatabase?.id
                                ? String(status.primaryDatabase.id).substring(0, 20) + '...'
                                : '(tanpa id)'}
                            </code>
                          </div>
                        ) : status?.isValid === false && !status.message?.includes('Belum') ? (
                          <span className={styles.databaseError}>Tidak terhubung</span>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* PRIVACY TOGGLE */}
                      <td className="table-cell-center">
                        <label className={styles.privacyToggle}>
                          <input
                            type="checkbox"
                            checked={e.is_public || false}
                            onChange={() => handleTogglePrivacy(e.id, e.is_public || false)}
                            disabled={loading}
                            className={styles.privacyCheckbox}
                          />
                          <span className={styles.privacyLabel}>
                            {e.is_public ? '🌐 Public' : '🔒 Private'}
                          </span>
                        </label>
                      </td>

                      {/* AKSI */}
                      <td className="table-cell-center">
                        <div className="table-actions">
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              setSelectedEntity(e);
                              setShowEdit(true);
                            }}
                            disabled={loading}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteEntity(e.id, e.entity_name)}
                            disabled={loading}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* LEGEND */}
        <div className={styles.legend}>
          <span className={styles.legendTitle}>Keterangan:</span>
          <div className={styles.legendList}>
            <div className={styles.legendItem}>
              <span className={styles.legendConnected}>✓ Terhubung</span> - Entitas terhubung dengan Accurate
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendDisconnected}>✗ Tidak Terhubung</span> - Token tidak valid
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendImportant}>🌐 Public:</span> Data realisasi dapat dilihat user lain di halaman Community
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendImportant}>🔒 Private:</span> Data hanya dapat dilihat oleh Anda
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendImportant}>Penting! :</span> Pilih satu entitas sebagai aktif untuk digunakan di seluruh aplikasi
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};