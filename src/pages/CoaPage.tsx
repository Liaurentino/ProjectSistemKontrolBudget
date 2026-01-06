import { useState, useEffect } from 'react';
import { getGLAccountList, searchGLAccounts, GLAccount } from '../lib/accurate';

export function COAPage() {
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);

    
      const sessionId = localStorage.getItem('accurate_session_id');
      const host = localStorage.getItem('accurate_host');
      
      if (!sessionId || !host) {
        throw new Error('Session tidak ditemukan. Silakan sync database terlebih dahulu.');
      }

      const response = await getGLAccountList(sessionId, host);
      setAccounts(response.d);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data');
      console.error('Error loading accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      loadAccounts();
      return;
    }

    try {
      setIsSearching(true);
      setError(null);



    const sessionId = localStorage.getItem('accurate_session_id');
      const host = localStorage.getItem('accurate_host');

      if (!sessionId || !host) {
        throw new Error('Session tidak ditemukan.');
      }

      const response = await searchGLAccounts(sessionId, host, query);
      setAccounts(response.d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat mencari data');
      console.error('Error searching accounts:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSyncAll = async () => {
    await loadAccounts();
  };

  const handleEdit = (account: GLAccount) => {
    console.log('Edit account:', account);
    // TODO: Implement edit functionality
  };

  const handleDelete = (account: GLAccount) => {
    console.log('Delete account:', account);
    // TODO: Implement delete functionality
  };

  const getAccountTypeBadge = (type?: string) => {
    switch(type) {
      case 'Kas/Bank':
        return 'badge-success';
      case 'Akun Piutang':
        return 'badge-warning';
      default:
        return 'badge-primary';
    }
  };

  if (loading) {
    return (
      <div className="coa-page">
        <div className="card card-center">
          <div className="spinner"></div>
          <p>Memuat data akun...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="coa-page">
      {/* Breadcrumb */}
      <div className="coa-breadcrumb">
        <span className="breadcrumb-icon">📁</span>
        <span className="breadcrumb-text">Master Data</span>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-active">List Akun</span>
      </div>

      {/* Header */}
      <div className="coa-header">
        <div className="coa-header-content">
          <h1 className="coa-title">Akun Perkiraan (Chart of Accounts)</h1>
          <p className="coa-subtitle">
            Kelola akun perkiraan dari Accurate Online atau manual entry
          </p>
        </div>
        <div className="coa-header-actions">
          <button 
            className="btn btn-primary coa-btn-sync"
            onClick={handleSyncAll}
            disabled={loading}
          >
            <span className="btn-icon">🔄</span>
            Sync All Entities
          </button>
          <button className="btn btn-secondary coa-btn-add">
            <span className="btn-icon">+</span>
            Tambah Manual
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="coa-search-container">
        <div className="coa-search-wrapper">
          <span className="coa-search-icon">🔍</span>
          <input
            type="text"
            className="coa-search-input"
            placeholder="Cari kode atau nama akun..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="alert alert-danger">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Table */}
      <div className="card coa-table-card">
        <div className="table-container">
          <table className="table coa-table">
            <thead>
              <tr>
                <th className="coa-table-th-number"># KODE</th>
                <th className="coa-table-th-name">NAMA AKUN</th>
                <th className="coa-table-th-type">TIPE</th>
                <th className="coa-table-th-status">STATUS</th>
                <th className="coa-table-th-actions">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {isSearching ? (
                <tr>
                  <td colSpan={5} className="coa-table-loading">
                    <div className="spinner"></div>
                    <span>Mencari...</span>
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="coa-table-empty">
                    <div className="empty-state-center">
                      <div className="empty-state-icon">📋</div>
                      <h3 className="empty-state-title">Tidak ada data akun</h3>
                      <p className="empty-state-description">
                        {searchQuery 
                          ? 'Tidak ditemukan akun yang sesuai dengan pencarian'
                          : 'Silakan sync data dari Accurate atau tambah akun manual'
                        }
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.id} className="coa-table-row">
                    <td className="coa-table-code">{account.number}</td>
                    <td className="coa-table-name">{account.name}</td>
                    <td className="coa-table-type">
                      <span className={`badge ${getAccountTypeBadge(account.accountType)}`}>
                        {account.accountType || 'Asset'}
                      </span>
                    </td>
                    <td className="coa-table-status">
                      <span className="badge badge-success">Aktif</span>
                    </td>
                    <td className="coa-table-actions">
                      <button 
                        className="coa-action-btn coa-action-edit"
                        title="Edit"
                        onClick={() => handleEdit(account)}
                      >
                        ✏️
                      </button>
                      <button 
                        className="coa-action-btn coa-action-delete"
                        title="Hapus"
                        onClick={() => handleDelete(account)}
                      >
                        🗑️
                      </button>
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
}