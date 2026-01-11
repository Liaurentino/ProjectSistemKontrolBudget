import React, { useEffect, useState } from 'react';
import { getEntities } from '../lib/supabase';
import { validateEntitasToken } from '../lib/accurate';
import type { AccurateDatabase } from '../lib/accurate';

export const AccurateSync: React.FC = () => {
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [error, setError] = useState('');

  // Sync status per entity
  const [syncStatus, setSyncStatus] = useState<Record<string, {
    status: 'idle' | 'loading' | 'success' | 'error';
    message:  string;
  }>>({});

  // Fetch entities on mount
  useEffect(() => {
    fetchEntities();
  }, []);

  const fetchEntities = async () => {
    setLoadingEntities(true);
    setError('');
    try {
      const { data, error:  err } = await getEntities();
      if (err) throw err;
      setEntities(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat entitas';
      setError(message);
    } finally {
      setLoadingEntities(false);
    }
  };

  /**
   * Test koneksi dan validasi token entitas
   */
  const handleValidateEntity = async (entity: any) => {
    if (!entity. api_token) {
      setSyncStatus((prev) => ({
        ...prev,
        [entity.id]:  {
          status: 'error',
          message: '❌ API Token belum dikonfigurasi',
        },
      }));
      return;
    }

    setSyncStatus((prev) => ({
      ...prev,
      [entity.id]: {
        status: 'loading',
        message:  '⏳ Memvalidasi token.. .',
      },
    }));

    try {
      const HMAC_SECRET = import.meta.env.VITE_ACCURATE_HMAC_SECRET || '';
      const result = await validateEntitasToken(entity. api_token, HMAC_SECRET);

      if (result.isValid) {
        setSyncStatus((prev) => ({
          ... prev,
          [entity.id]: {
            status: 'success',
            message: `✅ Terhubung - ${result.primaryDatabase?. name || 'Database'}`,
          },
        }));
      } else {
        setSyncStatus((prev) => ({
          ...prev,
          [entity.id]: {
            status: 'error',
            message:  `❌ ${result.message}`,
          },
        }));
      }
    } catch (err) {
      const message = err instanceof Error ? err. message : 'Error tidak diketahui';
      setSyncStatus((prev) => ({
        ...prev,
        [entity. id]: {
          status: 'error',
          message:  `❌ Error: ${message}`,
        },
      }));
    }
  };

  /**
   * Validate semua entities
   */
  const handleValidateAll = async () => {
    setLoading(true);
    try {
      for (const entity of entities) {
        await handleValidateEntity(entity);
        // Wait a bit between requests
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container fade-in">
      {/* HEADER */}
      <div className="app-header">
        <h1>⚙️ Pengaturan Sinkronisasi</h1>
        <p>Kelola dan validasi koneksi Accurate untuk setiap entitas</p>
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
          ⚠️ {error}
        </div>
      )}

      {/* MAIN CARD */}
      <div className="card fade-in">
        <div className="card-header">
          <h3 className="card-title">🔗 Validasi Koneksi Entitas</h3>
          <button
            className="btn btn-sm btn-secondary"
            onClick={handleValidateAll}
            disabled={loading || loadingEntities || entities.length === 0}
            style={{ marginLeft: 'auto' }}
          >
            {loading ? '⏳ Validasi Semua...' : '✓ Validasi Semua'}
          </button>
        </div>

        {loadingEntities ? (
          <div style={{ textAlign: 'center', padding:  '2rem', color: '#666' }}>
            Memuat entitas...
          </div>
        ) : entities.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '2rem',
              color: '#999',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
            }}
          >
            <p>Belum ada entitas yang dikonfigurasi</p>
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Silakan tambahkan entitas terlebih dahulu di halaman Manajemen Entitas
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            {entities. map((entity) => {
              const status = syncStatus[entity.id];

              return (
                <div
                  key={entity.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid #ddd',
                    borderRadius:  '8px',
                    backgroundColor: '#f9f9f9',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems:  'center',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div>
                      <h4
                        style={{
                          margin: '0 0 0.25rem 0',
                          fontSize: '1rem',
                          fontWeight: 600,
                        }}
                      >
                        {entity.entity_name}
                      </h4>
                      <small style={{ color: '#666', fontSize:  '0.85rem' }}>
                        {entity.api_token
                          ? `Token: ${entity.api_token. substring(0, 20)}...`
                          : 'Belum ada token'}
                      </small>
                    </div>

                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleValidateEntity(entity)}
                      disabled={loading || ! entity.api_token}
                      style={{
                        minWidth: '120px',
                      }}
                    >
                      {status?. status === 'loading'
                        ? '⏳ Validasi...'
                        : '🔍 Validasi'}
                    </button>
                  </div>

                  {/* Status */}
                  {status && (
                    <div
                      style={{
                        padding:  '0.75rem',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        backgroundColor: 
                          status.status === 'success'
                            ? '#e8f5e9'
                            : status.status === 'error'
                            ? '#ffebee'
                            : '#e3f2fd',
                        color: 
                          status.status === 'success'
                            ? '#2e7d32'
                            : status.status === 'error'
                            ? '#c62828'
                            : '#1565c0',
                        border:
                          status.status === 'success'
                            ? '1px solid #c8e6c9'
                            : status.status === 'error'
                            ? '1px solid #ffcdd2'
                            : '1px solid #bbdefb',
                      }}
                    >
                      {status.message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* INFO CARD */}
      <div
        className="card fade-in"
        style={{ marginTop: '1. 5rem', backgroundColor: '#f0f7ff', borderLeft: '4px solid #3498db' }}
      >
        <h4 style={{ margin: '0 0 1rem 0', color: '#1565c0' }}>
          ℹ️ Informasi Sinkronisasi
        </h4>

        <div style={{ fontSize: '0.9rem', color: '#666', lineHeight: '1.6' }}>
          <p>
            <strong>🔗 Koneksi: </strong> Validasi koneksi Accurate untuk memastikan
            API Token valid dan dapat mengakses data.
          </p>

          <p>
            <strong>✅ Status:</strong> Warna hijau berarti koneksi berhasil, merah
            berarti ada masalah dengan token atau koneksi.
          </p>

          <p>
            <strong>🔑 API Token:</strong> Pastikan setiap entitas memiliki API Token
            yang valid sebelum melakukan validasi.
          </p>

          <p>
            <strong>📋 Langkah: </strong>
          </p>
          <ol style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
            <li>Tambahkan atau edit entitas di halaman Manajemen Entitas</li>
            <li>Masukkan API Token yang valid dari Accurate</li>
            <li>Validasi koneksi dengan mengklik tombol "Validasi"</li>
            <li>Jika berhasil, Anda siap menggunakan fitur sinkronisasi data</li>
          </ol>
        </div>
      </div>

      {/* STATISTICS CARD */}
      {entities.length > 0 && (
        <div
          className="card fade-in"
          style={{ marginTop: '1.5rem', backgroundColor: '#f5f5f5' }}
        >
          <h4 style={{ margin: '0 0 1rem 0' }}>📊 Ringkasan</h4>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '1rem',
            }}
          >
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#fff',
                borderRadius: '8px',
                textAlign: 'center',
                border: '1px solid #ddd',
              }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3498db' }}>
                {entities.length}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                Total Entitas
              </div>
            </div>

            <div
              style={{
                padding: '1rem',
                backgroundColor: '#fff',
                borderRadius: '8px',
                textAlign: 'center',
                border: '1px solid #ddd',
              }}
            >
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: '#2ecc71',
                }}
              >
                {Object.values(syncStatus).filter((s) => s.status === 'success').length}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                Tervalidasi
              </div>
            </div>

            <div
              style={{
                padding: '1rem',
                backgroundColor: '#fff',
                borderRadius: '8px',
                textAlign:  'center',
                border:  '1px solid #ddd',
              }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e74c3c' }}>
                {Object.values(syncStatus).filter((s) => s.status === 'error').length}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                Error
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};