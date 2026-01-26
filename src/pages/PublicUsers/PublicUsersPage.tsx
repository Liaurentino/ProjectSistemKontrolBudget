import React, { useEffect, useState } from 'react';
import { getAllPublicUsersExceptSelf } from '../../lib/supabase';
import { getBudgetRealizationsLive } from '../../lib/accurate';
import PublicRealisasiViewer from '../../components/PublicRealisasi/PublicRealisasiViewer';
import styles from './PublicUsersPage.module.css';

interface PublicUser {
  user_id: string;
  user_email: string;
  user_name: string;
  user_avatar?: string;
  entities: Array<{
    id: string;
    entity_name: string;
    is_connected: boolean;
    created_at: string;
    has_realization?: boolean;
  }>;
}

export const PublicProfilesPage: React.FC = () => {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded state
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Selected entity for realisasi viewer
  const [selectedEntity, setSelectedEntity] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await getAllPublicUsersExceptSelf();

      if (err) throw new Error(err);

      // Check realization for each entity
      const usersWithRealizationCheck = await Promise.all(
        (data || []).map(async (user) => {
          const entitiesWithCheck = await Promise.all(
            user.entities.map(async (entity: any) => {
              // Check if entity has realization data
              const { data: realizationData } = await getBudgetRealizationsLive(entity.id);
              const hasRealization = (realizationData?.length || 0) > 0;

              return {
                ...entity,
                has_realization: hasRealization,
              };
            })
          );

          // Only include entities that are connected AND have realization data
          const validEntities = entitiesWithCheck.filter(
            (e) => e.is_connected && e.has_realization
          );

          return {
            ...user,
            entities: validEntities,
          };
        })
      );

      // Filter out users with no valid entities
      const usersWithValidEntities = usersWithRealizationCheck.filter(
        (user) => user.entities.length > 0
      );

      setUsers(usersWithValidEntities);
      setFilteredUsers(usersWithValidEntities);
    } catch (err: any) {
      setError('Gagal memuat data users: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Search filter
  useEffect(() => {
    if (!searchQuery) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = users.filter(
      (user) =>
        user.user_name.toLowerCase().includes(query) ||
        user.user_email.toLowerCase().includes(query)
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  const handleToggleEntities = (userId: string) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };

  const handleViewRealisasi = (entityId: string, entityName: string) => {
    setSelectedEntity({ id: entityId, name: entityName });
  };

  const handleCloseViewer = () => {
    setSelectedEntity(null);
  };

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1>🌐 Community Profiles</h1>
          <p>Lihat data realisasi budget dari user lain yang dipublikasikan</p>
        </div>

        <button onClick={loadUsers} className={styles.refreshButton} disabled={loading}>
          {loading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className={styles.errorAlert}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Info Box */}
      <div className={styles.infoBox}>
        <div className={styles.infoIcon}>ℹ️</div>
        <div className={styles.infoContent}>
          <strong>Informasi:</strong> Anda hanya dapat melihat data realisasi dari user lain yang sudah mempublikasikan entitas mereka dan memiliki data realisasi.
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchSection}>
        <input
          type="text"
          placeholder="🔍 Cari user berdasarkan nama atau email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
        <div className={styles.searchInfo}>
          Menampilkan <strong>{filteredUsers.length}</strong> dari {users.length} users
        </div>
      </div>

      {/* Users Table */}
      <div className={styles.tableContainer}>
        {loading && users.length === 0 ? (
          <div className={styles.loadingState}>⏳ Memuat data users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className={styles.emptyState}>
            {searchQuery ? (
              <>
                🔍 Tidak ada user yang cocok dengan pencarian "
                <strong>{searchQuery}</strong>"
              </>
            ) : (
              <>📋 Belum ada user lain yang mempublikasikan entitas dengan data realisasi</>
            )}
          </div>
        ) : (
          <table className={styles.usersTable}>
            <thead>
              <tr>
                <th>Avatar</th>
                <th>Nama User</th>
                <th>Email</th>
                <th>Jumlah Entitas Publik</th>
                <th className={styles.center}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <React.Fragment key={user.user_id}>
                  <tr className={styles.userRow}>
                    <td className={styles.avatarCell}>
                      {user.user_avatar ? (
                        <img
                          src={user.user_avatar}
                          alt={user.user_name}
                          className={styles.avatar}
                        />
                      ) : (
                        <div className={styles.avatarPlaceholder}>
                          {user.user_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className={styles.userName}>{user.user_name}</div>
                    </td>
                    <td>
                      <div className={styles.userEmail}>{user.user_email}</div>
                    </td>
                    <td>
                      <span className={styles.entitiesCount}>
                        {user.entities.length} entitas
                      </span>
                    </td>
                    <td className={styles.center}>
                      <button
                        onClick={() => handleToggleEntities(user.user_id)}
                        className={`${styles.viewButton} ${
                          expandedUserId === user.user_id ? styles.viewButtonActive : ''
                        }`}
                      >
                        {expandedUserId === user.user_id ? '🔼 Tutup' : '👁️ Lihat Entitas'}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Row - Entities List */}
                  {expandedUserId === user.user_id && (
                    <tr className={styles.entitiesRow}>
                      <td colSpan={5}>
                        <div className={styles.entitiesContainer}>
                          <h4 className={styles.entitiesTitle}>
                            📂 Entitas dari {user.user_name}
                          </h4>
                          <div className={styles.entitiesGrid}>
                            {user.entities.map((entity) => (
                              <div key={entity.id} className={styles.entityCard}>
                                <div className={styles.entityHeader}>
                                  <h5 className={styles.entityName}>
                                    {entity.entity_name}
                                  </h5>
                                  <span
                                    className={`${styles.connectionBadge} ${
                                      entity.is_connected
                                        ? styles.connected
                                        : styles.disconnected
                                    }`}
                                  >
                                    {entity.is_connected ? '✓ Terhubung ke Accurate' : '✗ Belum Terhubung ke Accurate'}
                                  </span>
                                </div>

                                <div className={styles.entityMeta}>
                                  <div>📅 Dibuat: {new Date(entity.created_at).toLocaleDateString('id-ID')}</div>
                                  <div className={styles.entityStatus}>
                                    {entity.has_realization && (
                                      <span className={styles.hasDataBadge}>
                                        ✓ Memiliki Data Realisasi
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <button
                                  onClick={() =>
                                    handleViewRealisasi(entity.id, entity.entity_name)
                                  }
                                  className={styles.viewRealisasiButton}
                                >
                                  📊 Lihat Realisasi
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Realisasi Viewer Modal */}
      {selectedEntity && (
        <PublicRealisasiViewer
          entityId={selectedEntity.id}
          entityName={selectedEntity.name}
          onClose={handleCloseViewer}
        />
      )}
    </div>
  );
};

export default PublicProfilesPage;