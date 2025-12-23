import React, { useState } from 'react';
import {
  getAccurateCategories,
  getChartOfAccounts,
  syncAccurateCategories,
  syncAccurateAccounts,
} from '../lib/accurate';

interface AccurateSyncProps {
  onSyncComplete?: () => void;
}

export const AccurateSync: React.FC<AccurateSyncProps> = ({ onSyncComplete }) => {
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    type: string;
    status: 'idle' | 'loading' | 'success' | 'error';
    message: string;
  }>({
    type: '',
    status: 'idle',
    message: '',
  });

  const handleSyncCategories = async () => {
    setLoading(true);
    setSyncStatus({ type: 'categories', status: 'loading', message: 'Sinkronisasi kategori...' });

    try {
      const { data, error } = await getAccurateCategories();
      if (error) throw error;

      if (data && data.data && Array.isArray(data.data)) {
        const { error: syncError } = await syncAccurateCategories(data.data);
        if (syncError) throw syncError;

        setSyncStatus({
          type: 'categories',
          status: 'success',
          message: `✅ Berhasil sinkronisasi ${data.data.length} kategori`,
        });
      }
    } catch (error) {
      setSyncStatus({
        type: 'categories',
        status: 'error',
        message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAccounts = async () => {
    setLoading(true);
    setSyncStatus({ type: 'accounts', status: 'loading', message: 'Sinkronisasi akun...' });

    try {
      const { data, error } = await getChartOfAccounts();
      if (error) throw error;

      if (data && data.data && Array.isArray(data.data)) {
        const { error: syncError } = await syncAccurateAccounts(data.data);
        if (syncError) throw syncError;

        setSyncStatus({
          type: 'accounts',
          status: 'success',
          message: `✅ Berhasil sinkronisasi ${data.data.length} akun`,
        });
      }
    } catch (error) {
      setSyncStatus({
        type: 'accounts',
        status: 'error',
        message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAll = async () => {
    setLoading(true);
    await handleSyncCategories();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await handleSyncAccounts();
    setLoading(false);
    onSyncComplete?.();
  };

  // Helper untuk menentukan class alert berdasarkan status
  const getAlertClass = () => {
    if (syncStatus.status === 'success') return 'alert-success';
    if (syncStatus.status === 'error') return 'alert-danger';
    return 'alert-info';
  };

  return (
    <div className="app-container fade-in">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">🔄 Sinkronisasi Data Accurate</h2>
        </div>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Sinkronisasi kategori dan chart of accounts dari Accurate ke database lokal untuk manajemen budget.
        </p>

        <div className="stats-grid mb-3">
          <button
            onClick={handleSyncCategories}
            disabled={loading}
            className="btn btn-primary"
            style={{ justifyContent: 'center', padding: '1rem' }}
          >
            {loading && syncStatus.type === 'categories' ? '⏳ Syncing...' : '📂 Sync Kategori'}
          </button>

          <button
            onClick={handleSyncAccounts}
            disabled={loading}
            className="btn btn-secondary"
            style={{ justifyContent: 'center', padding: '1rem' }}
          >
            {loading && syncStatus.type === 'accounts' ? '⏳ Syncing...' : '💰 Sync Akun'}
          </button>

          <button
            onClick={handleSyncAll}
            disabled={loading}
            className="btn btn-outline"
            style={{ justifyContent: 'center', padding: '1rem' }}
          >
            {loading ? '⏳ Syncing All...' : '⚡ Sync Semua'}
          </button>
        </div>

        {syncStatus.status !== 'idle' && (
          <div className={`alert ${getAlertClass()} fade-in`}>
            {syncStatus.message}
          </div>
        )}

        {loading && (
          <div className="text-center mt-2">
            <div className="spinner"></div>
          </div>
        )}
      </div>
    </div>
  );
};