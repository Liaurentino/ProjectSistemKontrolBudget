import React, { useEffect, useState } from 'react';
import {
  getLocalAccounts,
  subscribeAccounts,
  fetchAndSyncCOA,
  getSyncHistory,
  getEntitasList,
  type AccurateDatabase,
} from '../lib/accurate';

interface LocalAccount {
  id?: string;
  accurate_id: string;
  account_name: string;
  account_code: string;
  account_type: string;
  is_active?: boolean;
  updated_at?: string;
}

interface SyncHistory {
  id: string;
  sync_type: string;
  status: string;
  records_synced: number;
  synced_at: string;
  error_message?: string;
}

const CoaPage: React.FC = () => {
  const [accounts, setAccounts] = useState<LocalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [databases, setDatabases] = useState<AccurateDatabase[]>([]);
  const [selectedDbId, setSelectedDbId] = useState<string>('');
  const [lastSync, setLastSync] = useState<SyncHistory | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);

  // Load databases dari API Token
  async function loadDatabases() {
    try {
      const apiToken = localStorage.getItem('accurate_api_token');
      const secretKey = localStorage.getItem('accurate_secret_key');

      if (!apiToken || !secretKey) {
        setError('API Token belum dikonfigurasi. Silakan ke halaman Settings.');
        setLoading(false);
        return;
      }

      const result = await getEntitasList(apiToken, secretKey);

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.data && result.data.length > 0) {
        setDatabases(result.data);
        
        // Auto-select first database jika belum ada yang dipilih
        const savedDbId = localStorage.getItem('selected_db_id');
        if (savedDbId && result.data.find(db => db.id === savedDbId)) {
          setSelectedDbId(savedDbId);
        } else {
          setSelectedDbId(result.data[0].id);
          localStorage.setItem('selected_db_id', result.data[0].id);
        }
      }
    } catch (err: any) {
      console.error('Error loading databases:', err);
      setError('Gagal memuat daftar database: ' + err.message);
    }
  }

  // Load accounts dari database lokal
  async function loadAccounts() {
    try {
      setError(null);
      setLoading(true);

      const { data, error } = await getLocalAccounts();
      if (error) throw error;

      setAccounts(data ?? []);

      // Load last sync info
      const { data: history } = await getSyncHistory(1);
      if (history && history.length > 0) {
        setLastSync(history[0]);
      }

      if (!data || data.length === 0) {
        setSyncStatus(
          'Database lokal kosong. Klik "Sync dari Accurate" untuk mengambil data COA.'
        );
      }
    } catch (err: any) {
      console.error('Error loading accounts:', err);
      setError(err?.message || 'Gagal memuat daftar akun dari database lokal.');
    } finally {
      setLoading(false);
    }
  }

  // Load sync history
  async function loadSyncHistory() {
    try {
      const { data, error } = await getSyncHistory(20);
      if (error) throw error;
      setSyncHistory(data ?? []);
    } catch (err: any) {
      console.error('Error loading sync history:', err);
    }
  }

  // Sync COA dari Accurate API via Edge Function
  async function handleSync() {
    if (!selectedDbId) {
      setError('Pilih database terlebih dahulu');
      return;
    }

    try {
      setSyncing(true);
      setError(null);
      setSyncStatus('🔄 Menghubungi Accurate API...');

      const result = await fetchAndSyncCOA(selectedDbId);

      if (!result.success) {
        throw new Error(result.error || 'Sync gagal');
      }

      setSyncStatus(`✅ Berhasil sync ${result.synced} akun COA dari Accurate`);

      // Reload accounts
      await loadAccounts();

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSyncStatus(null);
      }, 5000);
    } catch (err: any) {
      console.error('Error syncing COA:', err);
      setError('Gagal sync COA: ' + err.message);
      setSyncStatus(null);
    } finally {
      setSyncing(false);
    }
  }

  // Handle database change
  function handleDatabaseChange(dbId: string) {
    setSelectedDbId(dbId);
    localStorage.setItem('selected_db_id', dbId);
  }

  useEffect(() => {
    loadDatabases();
    loadAccounts();
    loadSyncHistory();

    const channel = subscribeAccounts(() => {
      console.log('[CoaPage] Realtime update detected');
      loadAccounts();
    });

    return () => {
      try {
        channel?.unsubscribe();
      } catch {}
    };
  }, []);

  return (
    <div className="coa-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }}>
            Chart of Accounts
          </h2>
          {lastSync && (
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6c757d' }}>
              Last sync: {new Date(lastSync.synced_at).toLocaleString('id-ID')} 
              {' '}({lastSync.records_synced} records)
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {databases.length > 0 && (
            <select
              value={selectedDbId}
              onChange={(e) => handleDatabaseChange(e.target.value)}
              disabled={syncing}
              style={{
                padding: '10px 16px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '14px',
                minWidth: '200px',
              }}
            >
              {databases.map((db) => (
                <option key={db.id} value={db.id}>
                  {db.name} ({db.code})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleSync}
            disabled={syncing || !selectedDbId}
            style={{
              padding: '10px 20px',
              backgroundColor: syncing ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: syncing ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {syncing ? (
              <>
                <span style={{ animation: 'spin 1s linear infinite' }}>⟳</span>
                Syncing...
              </>
            ) : (
              <>🔄 Sync dari Accurate</>
            )}
          </button>

          <button
            onClick={loadAccounts}
            disabled={loading || syncing}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              fontSize: '14px',
            }}
          >
            ↻ Refresh
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '14px',
            }}
          >
            📊 History
          </button>
        </div>
      </div>

      {/* Sync History Panel */}
      {showHistory && (
        <div style={{
          padding: '16px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          marginBottom: '16px',
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>Sync History</h3>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {syncHistory.map((sync) => (
              <div
                key={sync.id}
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                }}
              >
                <span>
                  {sync.status === 'success' ? '✅' : '❌'} {sync.sync_type} - {sync.records_synced} records
                </span>
                <span style={{ color: '#6c757d' }}>
                  {new Date(sync.synced_at).toLocaleTimeString('id-ID')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '6px',
          color: '#721c24',
          marginBottom: '16px',
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Sync Status Alert */}
      {syncStatus && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#d1ecf1',
          border: '1px solid #bee5eb',
          borderRadius: '6px',
          color: '#0c5460',
          marginBottom: '16px',
        }}>
          {syncStatus}
        </div>
      )}

      {/* Loading State */}
      {loading && accounts.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px',
          color: '#6c757d',
          fontSize: '16px'
        }}>
          ⏳ Memuat data COA...
        </div>
      ) : (
        /* COA Table */
        <div style={{ 
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'white',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={tableHeaderStyle}>Kode Akun</th>
                  <th style={tableHeaderStyle}>Nama Akun</th>
                  <th style={tableHeaderStyle}>Tipe</th>
                  <th style={tableHeaderStyle}>Status</th>
                  <th style={tableHeaderStyle}>Last Update</th>
                </tr>
              </thead>

              <tbody>
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{
                      padding: '60px 20px',
                      textAlign: 'center',
                      color: '#6c757d',
                      fontSize: '16px'
                    }}>
                      📋 Belum ada data COA.{' '}
                      {databases.length > 0
                        ? 'Klik tombol "Sync dari Accurate" untuk mengambil data.'
                        : 'Konfigurasi API Token terlebih dahulu di halaman Settings.'}
                    </td>
                  </tr>
                )}

                {accounts.map((acc) => (
                  <tr key={acc.accurate_id} style={{
                    borderBottom: '1px solid #dee2e6',
                    transition: 'background-color 0.2s',
                  }}>
                    <td style={tableCellStyle}>
                      <strong>{acc.account_code}</strong>
                    </td>
                    <td style={tableCellStyle}>{acc.account_name}</td>
                    <td style={tableCellStyle}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        backgroundColor: '#e7f3ff',
                        color: '#0066cc',
                        fontSize: '13px',
                        fontWeight: 500,
                      }}>
                        {acc.account_type}
                      </span>
                    </td>
                    <td style={tableCellStyle}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '13px',
                        fontWeight: 500,
                        backgroundColor: acc.is_active !== false ? '#d4edda' : '#f8d7da',
                        color: acc.is_active !== false ? '#155724' : '#721c24',
                      }}>
                        {acc.is_active !== false ? '✓ Aktif' : '✗ Nonaktif'}
                      </span>
                    </td>
                    <td style={tableCellStyle}>
                      <span style={{ fontSize: '13px', color: '#6c757d' }}>
                        {acc.updated_at 
                          ? new Date(acc.updated_at).toLocaleDateString('id-ID')
                          : '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer with count */}
          {accounts.length > 0 && (
            <div style={{
              padding: '16px 20px',
              backgroundColor: '#f8f9fa',
              borderTop: '1px solid #dee2e6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '14px', color: '#6c757d' }}>
                Total: <strong>{accounts.length}</strong> akun COA
              </span>
              <span style={{ fontSize: '13px', color: '#adb5bd' }}>
                {accounts.filter(a => a.is_active !== false).length} aktif, {' '}
                {accounts.filter(a => a.is_active === false).length} nonaktif
              </span>
            </div>
          )}
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

// Styles
const tableHeaderStyle: React.CSSProperties = {
  padding: '14px 16px',
  textAlign: 'left',
  fontSize: '13px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#495057',
  borderBottom: '2px solid #dee2e6',
};

const tableCellStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: '14px',
  color: '#212529',
};

export default CoaPage;