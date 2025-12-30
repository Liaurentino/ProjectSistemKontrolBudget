import React, { useEffect, useState } from 'react';
import { getEntities, deleteEntity } from '../lib/supabase';
import { EntitasForm } from '../components/EntitasForm';

export const EntitasPage: React.FC = () => {
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // EXISTING
  const [showForm, setShowForm] = useState(false);

  // TAMBAHAN (EDIT)
  const [showEdit, setShowEdit] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);

  const fetchEntities = async () => {
    setLoading(true);
    try {
      const { data, error } = await getEntities();
      if (error) throw error;
      setEntities(data || []);
    } catch (err) {
      console.error(err);
      alert('Gagal memuat entitas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntities();
  }, []);

  return (
    <div className="app-container fade-in">
      {/* HEADER */}
      <div className="app-header">
        <h1>🏢 Manajemen Entitas</h1>
        <p>Kelola entitas perusahaan yang digunakan pada budget</p>
      </div>

      {/* CARD */}
      <div className="card fade-in">
        <div className="card-header">
          <h3 className="card-title">Daftar Entitas</h3>
        </div>

        {/* BUTTON TAMBAH */}
        {!showForm && (
          <button
            className="btn btn-primary mb-3"
            onClick={() => setShowForm(true)}
          >
            + Tambah Entitas
          </button>
        )}

        {/* FORM TAMBAH (INLINE) */}
        {showForm && (
          <div>
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

        {/* FORM EDIT (MODAL MELAYANG) */}
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
                <th>Nama Entitas</th>
                <th>ID</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>

            <tbody>
              {loading && entities.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center">
                    Memuat data...
                  </td>
                </tr>
              ) : entities.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center">
                    Belum ada entitas
                  </td>
                </tr>
              ) : (
                entities.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>
                      {e.entity_name}
                    </td>
                    <td>{e.id.slice(0, 8)}...</td>
                    <td style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          gap: '6px',
                        }}
                      >
                        {/* EDIT */}
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setSelectedEntity(e);
                            setShowEdit(true);
                          }}
                        >
                          Edit
                        </button>

                        {/* SYNC */}
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() =>
                            alert(
                              `Sync Accurate untuk ${e.entity_name} (coming soon)`
                            )
                          }
                        >
                          Sync
                        </button>

                        {/* DELETE */}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={async () => {
                            if (
                              confirm(
                                `Yakin ingin menghapus entitas "${e.entity_name}"?`
                              )
                            ) {
                              await deleteEntity(e.id);
                              fetchEntities();
                            }
                          }}
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
      </div>
    </div>
  );
};
