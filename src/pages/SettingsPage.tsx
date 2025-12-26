import React, { useState } from 'react';
import {
  getAccurateCategories,
  getChartOfAccounts,
  syncAccurateCategories,
  syncAccurateAccounts,
} from '../lib/accurate';

export const AccurateSync: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState({
    type: '',
    status: 'idle' as 'idle' | 'loading' | 'success' | 'error',
    message: '',
  });

  const handleSyncCategories = async () => {
    setLoading(true);
    setSyncStatus({ type: 'categories', status: 'loading', message: 'Sinkronisasi kategori...' });

    try {
      const { data } = await getAccurateCategories();
      await syncAccurateCategories(data.data);
      setSyncStatus({
        type: 'categories',
        status: 'success',
        message: `✅ Berhasil sinkronisasi ${data.data.length} kategori`,
      });
    } catch (error) {
      setSyncStatus({
        type: 'categories',
        status: 'error',
        message: '❌ Gagal sinkronisasi kategori',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAccounts = async () => {
    setLoading(true);
    setSyncStatus({ type: 'accounts', status: 'loading', message: 'Sinkronisasi akun...' });

    try {
      const { data } = await getChartOfAccounts();
      await syncAccurateAccounts(data.data);
      setSyncStatus({
        type: 'accounts',
        status: 'success',
        message: `✅ Berhasil sinkronisasi ${data.data.length} akun`,
      });
    } catch (error) {
      setSyncStatus({
        type: 'accounts',
        status: 'error',
        message: '❌ Gagal sinkronisasi akun',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container fade-in">
      <div className="card">
        <h2 className="card-title">🔄 Sinkronisasi Data Accurate</h2>

        <div className="stats-grid mb-3">
          <button onClick={handleSyncCategories} disabled={loading} className="btn btn-primary">
            Sync Kategori
          </button>

          <button onClick={handleSyncAccounts} disabled={loading} className="btn btn-secondary">
            Sync Akun
          </button>
        </div>

        {syncStatus.status !== 'idle' && (
          <div className={`alert alert-${syncStatus.status}`}>
            {syncStatus.message}
          </div>
        )}
      </div>
    </div>
  );
};
