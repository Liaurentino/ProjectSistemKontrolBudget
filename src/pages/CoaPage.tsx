import React, { useEffect, useState } from 'react';
import { useEntity } from '../contexts/EntityContext';
import { 
  fetchCoaFromAccurate, 
  getLocalAccounts,
  subscribeAccounts,
  type CoaAccount 
} from '../lib/accurate';

const CoaPage: React.FC = () => {
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'database' | 'api'>('database');

  const { activeEntity } = useEntity();

  // Check if webhook is enabled for this entity
  useEffect(() => {
    if (activeEntity?.accurate_database_id) {
      setWebhookEnabled(true);
    } else {
      setWebhookEnabled(false);
    }
  }, [activeEntity]);

  /**
   * Load COA data dari Supabase (data yang sudah disimpan oleh webhook)
   */
  async function loadCoaFromDatabase() {
    if (!activeEntity?.id) return;

    try {
      setLoading(true);
      setError(null);

      console.log('[CoaPage] Loading COA from database for entity:', activeEntity.id);

      const { data, error: dbError } = await getLocalAccounts(activeEntity.id);

      if (dbError) {
        console.error('[CoaPage] Database error:', dbError);
        throw new Error(dbError.message);
      }

      console.log('[CoaPage] Loaded accounts from database:', data?.length || 0);

      // Map database structure to CoaAccount type
      const mappedAccounts: CoaAccount[] = (data || []).map((acc: any) => ({
        id: acc.accurate_id,
        account_code: acc.account_code,
        account_name: acc.account_name,
        account_type: acc.account_type,
        account_type_name: acc.account_type_name || acc.account_type,
        balance: acc.balance || 0,
        currency: acc.currency || 'IDR',
        is_parent: false,
        suspended: acc.suspended || false,
        parent_id: null,
      }));

      setAccounts(mappedAccounts);
      setDataSource('database');
      setLastSync(new Date().toLocaleString('id-ID'));

      if (mappedAccounts.length === 0) {
        setSyncStatus('ℹ️ Belum ada data COA di database. Klik "Tarik dari Accurate" untuk sync pertama kali.');
      }
    } catch (err: any) {
      console.error('[CoaPage] Error loading from database:', err);
      setError('Gagal memuat COA dari database: ' + err.message);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Manual sync COA dari Accurate API (fallback / initial load)
   */
  async function handleManualSync() {
    if (!activeEntity) {
      setError('Tidak ada entitas yang aktif. Pilih entitas di halaman Manajemen Entitas.');
      return;
    }

    if (!activeEntity.api_token) {
      setError('API Token tidak ditemukan untuk entitas ini. Silakan edit entitas dan tambahkan API Token.');
      return;
    }

    try {
      setSyncing(true);
      setError(null);
      setSyncStatus('🔄 Mengambil data COA dari Accurate API...');

      const result = await fetchCoaFromAccurate(activeEntity.id, activeEntity.api_token);

      if (!result.success) {
        throw new Error(result.error || 'Gagal mengambil data COA');
      }

      setAccounts(result.accounts || []);
      setDataSource('api');
      setLastSync(new Date().toLocaleString('id-ID'));
      
      setSyncStatus(
        `✅ Berhasil mengambil ${result.total} akun COA dari Accurate${
          result.pagination ? ` (Page ${result.pagination.page}/${result.pagination.pageCount})` : ''
        }`
      );

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSyncStatus(null);
      }, 5000);
    } catch (err: any) {
      console.error('[CoaPage] Error syncing COA:', err);
      setError('Gagal mengambil COA: ' + err.message);
      setSyncStatus(null);
    } finally {
      setSyncing(false);
    }
  }

  /**
   * Initial load dan setup real-time subscription
   */
  useEffect(() => {
    if (!activeEntity?.id) {
      setAccounts([]);
      setError(null);
      setSyncStatus(null);
      return;
    }

    // Load data from database
    loadCoaFromDatabase();

    // Setup real-time subscription (auto-refresh when webhook updates data)
    console.log('[CoaPage] Setting up real-time subscription for entity:', activeEntity.id);
    
    const subscription = subscribeAccounts(activeEntity.id, () => {
      console.log('[CoaPage] Real-time update detected, reloading data...');
      loadCoaFromDatabase();
      setSyncStatus('🔔 Data COA diperbarui secara otomatis via webhook!');
      
      // Clear notification after 3 seconds
      setTimeout(() => {
        setSyncStatus(null);
      }, 3000);
    });

    // Cleanup subscription on unmount
    return () => {
      console.log('[CoaPage] Cleaning up real-time subscription');
      subscription.unsubscribe();
    };
  }, [activeEntity?.id]);

  return (
    <div className="coa-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }}>Chart of Accounts</h2>
          {activeEntity ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#6c757d' }}>
                Entitas: <strong>{activeEntity.entity_name || activeEntity.name || 'Unknown'}</strong>
              </p>
              {webhookEnabled && (
                <span
                  style={{
                    padding: '2px 8px',
                    backgroundColor: '#d4edda',
                    color: '#155724',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  🔔 Webhook Active
                </span>
              )}
              {lastSync && (
                <span
                  style={{
                    padding: '2px 8px',
                    backgroundColor: '#e7f3ff',
                    color: '#0066cc',
                    borderRadius: '12px',
                    fontSize: '11px',
                  }}
                >
                  Last sync: {lastSync}
                </span>
              )}
              <span
                style={{
                  padding: '2px 8px',
                  backgroundColor: dataSource === 'database' ? '#d4edda' : '#fff3cd',
                  color: dataSource === 'database' ? '#155724' : '#856404',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 500,
                }}
              >
                {dataSource === 'database' ? '💾 From Database' : '☁️ From API'}
              </span>
            </div>
          ) : (
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#dc3545' }}>
              ⚠️ Tidak ada entitas yang aktif
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={loadCoaFromDatabase}
            disabled={loading || !activeEntity}
            style={{
              padding: '10px 20px',
              backgroundColor: loading ? '#6c757d' : activeEntity ? '#17a2b8' : '#adb5bd',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading || !activeEntity ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {loading ? (
              <>
                <span style={{ animation: 'spin 1s linear infinite' }}>⟳</span>
                Loading...
              </>
            ) : (
              <>🔄 Refresh dari Database</>
            )}
          </button>
          
          <button
            onClick={handleManualSync}
            disabled={syncing || !activeEntity}
            style={{
              padding: '10px 20px',
              backgroundColor: syncing ? '#6c757d' : activeEntity ? '#28a745' : '#adb5bd',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: syncing || !activeEntity ? 'not-allowed' : 'pointer',
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
              <>☁️ Tarik dari Accurate</>
            )}
          </button>
        </div>
      </div>

      {/* No Active Entity Warning */}
      {!activeEntity && (
        <div
          style={{
            padding: '20px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '8px',
            marginBottom: '16px',
            textAlign: 'center',
          }}
        >
          <h3 style={{ margin: '0 0 8px', color: '#856404' }}>⚠️ Belum Ada Entitas Aktif</h3>
          <p style={{ margin: '0 0 12px', color: '#856404' }}>
            Silakan pilih entitas terlebih dahulu di halaman <strong>Manajemen Entitas</strong>
          </p>
          <a
            href="/entitas"
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              backgroundColor: '#ffc107',
              color: '#000',
              textDecoration: 'none',
              borderRadius: '4px',
              fontWeight: 600,
            }}
          >
            Ke Halaman Entitas →
          </a>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '6px',
            color: '#721c24',
            marginBottom: '16px',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Sync Status Alert */}
      {syncStatus && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#d1ecf1',
            border: '1px solid #bee5eb',
            borderRadius: '6px',
            color: '#0c5460',
            marginBottom: '16px',
          }}
        >
          {syncStatus}
        </div>
      )}

      {/* COA Table */}
      <div
        style={{
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'white',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={tableHeaderStyle}>Kode Akun</th>
                <th style={tableHeaderStyle}>Nama Akun</th>
                <th style={tableHeaderStyle}>Tipe</th>
                <th style={tableHeaderStyle}>Saldo</th>
                <th style={tableHeaderStyle}>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '60px 20px', textAlign: 'center', color: '#6c757d' }}>
                    ⏳ Memuat data COA...
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: '60px 20px',
                      textAlign: 'center',
                      color: '#6c757d',
                      fontSize: '16px',
                    }}
                  >
                    📋 Belum ada data COA.{' '}
                    {activeEntity
                      ? 'Klik tombol "Tarik dari Accurate" untuk mengambil data pertama kali.'
                      : 'Pilih entitas terlebih dahulu di halaman Manajemen Entitas.'}
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => (
                  <tr
                    key={acc.id}
                    style={{
                      borderBottom: '1px solid #dee2e6',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <td style={tableCellStyle}>
                      <strong>{acc.account_code}</strong>
                    </td>
                    <td style={tableCellStyle}>{acc.account_name}</td>
                    <td style={tableCellStyle}>
                      <span
                        style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          backgroundColor: '#e7f3ff',
                          color: '#0066cc',
                          fontSize: '13px',
                          fontWeight: 500,
                        }}
                      >
                        {acc.account_type_name}
                      </span>
                    </td>
                    <td style={tableCellStyle}>
                      <span style={{ fontFamily: 'monospace' }}>
                        {acc.currency} {acc.balance.toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td style={tableCellStyle}>
                      <span
                        style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: 500,
                          backgroundColor: !acc.suspended ? '#d4edda' : '#f8d7da',
                          color: !acc.suspended ? '#155724' : '#721c24',
                        }}
                      >
                        {!acc.suspended ? '✓ Aktif' : '✗ Suspended'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with count */}
        {accounts.length > 0 && (
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: '#f8f9fa',
              borderTop: '1px solid #dee2e6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '14px', color: '#6c757d' }}>
              Total: <strong>{accounts.length}</strong> akun COA
            </span>
            <span style={{ fontSize: '13px', color: '#adb5bd' }}>
              {accounts.filter((a) => !a.suspended).length} aktif,{' '}
              {accounts.filter((a) => a.suspended).length} suspended
            </span>
          </div>
        )}
      </div>

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