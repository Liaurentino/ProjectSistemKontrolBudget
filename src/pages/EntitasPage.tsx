import React, { useEffect, useState } from 'react';
import { getEntities, deleteEntity } from '../lib/supabase';
import { EntitasForm } from '../components/EntitasForm';
import { AccurateGuide } from '../components/AccurateGuide'; // ← IMPORT PANDUAN
import { useEntity } from '../contexts/EntityContext';
import { validateEntitasToken } from '../lib/accurate';
import type { AccurateValidationResult } from '../lib/accurate';

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
   * Fetch entitas dari Supabase
   */
  const fetchEntities = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await getEntities();
      if (err) throw new Error(typeof err === 'string' ? err : err.message);
      setEntities(data || []);
      setContextEntities(data || []); // Update context
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat entitas';
      setError(message);
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
      if (err) throw new Error(typeof err === 'string' ? err : err.message);
      
      // Jika entity yang dihapus adalah active entity, clear selection
      if (isEntityActive(id)) {
        setActiveEntity(null);
      }
      
      await fetchEntities();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus entitas';
      setError(message);
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
      {/* HEADER - DENGAN TOMBOL PANDUAN */}
      <div className="app-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        gap: '1rem',
      }}>
        <div style={{ flex: 1 }}>
          <h1>Manajemen Entitas</h1>
          <p>Kelola koneksi entitas perusahaan Anda dengan Accurate</p>
        </div>
        
        {/* TOMBOL PANDUAN - DI LUAR CONTAINER */}
        <div style={{ flexShrink: 0, paddingTop: '0.25rem' }}>
          <AccurateGuide />
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#ffebee',
            color: '#c62828',
            borderRadius: '8px',
            marginBottom: '1rem',
          }}
        >
          Error: {error}
        </div>
      )}

      {/* CARD */}
      <div className="card fade-in">
        <div className="card-header">
          <h3 className="card-title">Daftar Entitas</h3>
          <button
            className="btn btn-sm btn-secondary"
            onClick={checkAllStatus}
            disabled={refreshing || loading}
            style={{ marginLeft: 'auto' }}
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
          <div style={{ marginBottom: '1rem' }}>
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

        {/* TABLE */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '60px', textAlign: 'center' }}>Aktif</th>
                <th>Nama Entitas</th>
                <th>Status Koneksi</th>
                <th>Database</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>

            <tbody>
              {loading && entities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center">
                    Memuat data...
                  </td>
                </tr>
              ) : entities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center">
                    Belum ada entitas. Silakan tambahkan entitas baru untuk memulai.
                  </td>
                </tr>
              ) : (
                entities.map((e) => {
                  const status = entityStatus[e.id];
                  const statusColor = status?.isValid ? '#4caf50' : '#f44336';
                  const statusText = status?.isValid ? '✓ Terhubung' : '✗ Invalid';

                  return (
                    <tr key={e.id}>
                      {/* AKTIF - RADIO */}
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="radio"
                          name="active-entity"
                          checked={isEntityActive(e.id)}
                          onChange={() => setActiveEntity(e.id)}
                          disabled={loading}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      {/* NAMA ENTITAS */}
                      <td style={{ fontWeight: 600 }}>{e.entity_name}</td>

                      {/* STATUS KONEKSI */}
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.75rem',
                            backgroundColor: statusColor,
                            color: '#fff',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                          }}
                        >
                          {statusText}
                        </span>
                      </td>
 
                      {/* DATABASE */}
                      <td style={{ fontSize: '0.9rem', color: '#666' }}>
                        {status?.primaryDatabase ? (
                          <div>
                            <div style={{ fontWeight: 500 }}>{status.primaryDatabase.name}</div>
                            <code style={{ fontSize: '0.75rem', color: '#999' }}>
                              {status?.primaryDatabase?.id
                                ? String(status.primaryDatabase.id).substring(0, 20) + '...'
                                : '(tanpa id)'}
                            </code>
                          </div>
                        ) : status?.isValid === false && !status.message?.includes('Belum') ? (
                          <span style={{ color: '#f44336' }}>Tidak terhubung</span>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* AKSI */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
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
        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid #eee',
            fontSize: '0.85rem',
          }}
        >
          <strong>Keterangan:</strong>
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ color: '#4caf50', fontWeight: 'bold' }}>✓ Terhubung</span> - Entitas terhubung dengan Accurate
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ color: '#f44336', fontWeight: 'bold' }}>✗ Invalid</span> - Token tidak valid
            </div>
            <div>
              <span style={{ fontWeight: 'bold' }}>Penting! :</span> Pilih satu entitas sebagai aktif untuk digunakan di seluruh aplikasi
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};