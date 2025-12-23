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

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4">
        🔄 Sinkronisasi Data dari Accurate
      </h3>

      <p className="text-sm text-gray-600 mb-6">
        Sinkronisasi kategori dan chart of accounts dari Accurate ke database lokal
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button
          onClick={handleSyncCategories}
          disabled={loading}
          className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading && syncStatus.type === 'categories' ? '⏳ Syncing...' : '📂 Sync Kategori'}
        </button>

        <button
          onClick={handleSyncAccounts}
          disabled={loading}
          className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading && syncStatus.type === 'accounts' ? '⏳ Syncing...' : '💰 Sync Akun'}
        </button>

        <button
          onClick={handleSyncAll}
          disabled={loading}
          className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? '⏳ Syncing All...' : '⚡ Sync Semua'}
        </button>
      </div>

      {syncStatus.status !== 'idle' && (
        <div
          className={`p-4 rounded-lg text-sm ${
            syncStatus.status === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : syncStatus.status === 'error'
              ? 'bg-red-50 border border-red-200 text-red-800'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}
        >
          {syncStatus.message}
        </div>
      )}
    </div>
  );
};
