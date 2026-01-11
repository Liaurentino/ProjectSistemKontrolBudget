import React, { useEffect, useState } from 'react';
import { useEntity } from '../contexts/EntityContext';
import { BudgetForm } from '../components/BudgetForm';
import {
  getBudgets,
  getBudgetsByYear,
  getBudgetById,
  deleteBudget,
  subscribeBudgets,
  type Budget,
  type BudgetWithItems,
} from '../lib/accurate';

// Helper: Get adaptive font size based on amount
const getAdaptiveFontSize = (amount: number): number => {
  if (amount >= 1_000_000_000_000) return 14; // >= 1 Triliun
  if (amount >= 1_000_000_000) return 16;      // 1-999 Miliar
  return 18;                                    // < 1 Miliar
};

// Helper: Format currency - NO abbreviations, full number
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('id-ID');
};

const BudgetPage: React.FC = () => {
  const { activeEntity } = useEntity();

  // State
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [allBudgets, setAllBudgets] = useState<Budget[]>([]);
  const [expandedBudgets, setExpandedBudgets] = useState<Map<string, BudgetWithItems>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithItems | null>(null);

  // Available years from ALL budgets (not filtered)
  const availableYears = Array.from(
    new Set(allBudgets.map((b) => b.period.split('-')[0]))
  ).sort((a, b) => b.localeCompare(a));

  /**
   * Load budgets
   */
  const loadBudgets = async () => {
    if (!activeEntity?.id) return;

    setLoading(true);
    setError(null);

    try {
      console.log('[BudgetPage] Loading budgets for entity:', activeEntity.id);

      // ALWAYS load ALL budgets first
      const allResult = await getBudgets(activeEntity.id);
      
      if (allResult.error) throw allResult.error;
      
      // Save ALL budgets untuk availableYears
      setAllBudgets(allResult.data || []);

      // Then filter by year if needed
      let filteredData = allResult.data || [];
      if (selectedYear !== 'all') {
        filteredData = filteredData.filter(b => b.period.startsWith(selectedYear));
      }

      setBudgets(filteredData);
      console.log('[BudgetPage] Loaded', filteredData.length, 'budgets (filtered from', allResult.data?.length, 'total)');
    } catch (err: any) {
      console.error('[BudgetPage] Error loading budgets:', err);
      setError('Gagal memuat data budget: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Toggle expand budget (load items)
   */
  const toggleExpandBudget = async (budgetId: string) => {
    if (expandedBudgets.has(budgetId)) {
      const newExpanded = new Map(expandedBudgets);
      newExpanded.delete(budgetId);
      setExpandedBudgets(newExpanded);
    } else {
      try {
        console.log('[BudgetPage] Loading items for budget:', budgetId);
        const { data, error } = await getBudgetById(budgetId);

        if (error) throw error;

        const newExpanded = new Map(expandedBudgets);
        newExpanded.set(budgetId, data!);
        setExpandedBudgets(newExpanded);
      } catch (err: any) {
        console.error('[BudgetPage] Error loading budget items:', err);
        setError('Gagal memuat detail budget: ' + err.message);
      }
    }
  };

  /**
   * Handle delete budget
   */
  const handleDeleteBudget = async (budgetId: string, budgetName: string) => {
    if (!confirm(`Yakin ingin menghapus budget "${budgetName}"?\n\nSemua alokasi akun akan ikut terhapus.`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await deleteBudget(budgetId);
      if (error) throw error;

      console.log('[BudgetPage] Budget deleted');
      await loadBudgets();

      if (expandedBudgets.has(budgetId)) {
        const newExpanded = new Map(expandedBudgets);
        newExpanded.delete(budgetId);
        setExpandedBudgets(newExpanded);
      }
    } catch (err: any) {
      console.error('[BudgetPage] Error deleting budget:', err);
      setError('Gagal menghapus budget: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle edit budget
   */
  const handleEditBudget = async (budgetId: string) => {
    try {
      const { data, error } = await getBudgetById(budgetId);
      if (error) throw error;

      setEditingBudget(data);
      setShowForm(true);
    } catch (err: any) {
      console.error('[BudgetPage] Error loading budget for edit:', err);
      setError('Gagal memuat budget untuk edit: ' + err.message);
    }
  };

  /**
   * Handle form success
   */
  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingBudget(null);
    loadBudgets();
  };

  /**
   * Handle form cancel
   */
  const handleFormCancel = () => {
    setShowForm(false);
    setEditingBudget(null);
  };

  /**
   * Initial load
   */
  useEffect(() => {
    if (activeEntity?.id) {
      loadBudgets();
    } else {
      setBudgets([]);
    }
  }, [activeEntity?.id, selectedYear]);

  /**
   * Setup real-time subscription
   */
  useEffect(() => {
    if (!activeEntity?.id) return;

    console.log('[BudgetPage] Setting up real-time subscription...');

    const subscription = subscribeBudgets(activeEntity.id, () => {
      console.log('[BudgetPage] Real-time update detected, reloading...');
      loadBudgets();
    });

    return () => {
      console.log('[BudgetPage] Cleaning up subscription...');
      subscription.unsubscribe();
    };
  }, [activeEntity?.id]);

  /**
   * Filter budgets by search
   */
  const filteredBudgets = budgets.filter((budget) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      budget.name?.toLowerCase().includes(query) ||
      budget.period.toLowerCase().includes(query) ||
      budget.description?.toLowerCase().includes(query)
    );
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }}>💰 Manajemen Budget</h2>
          {activeEntity ? (
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6c757d' }}>
              Entitas: <strong>{activeEntity.entity_name || activeEntity.name || 'Unknown'}</strong>
            </p>
          ) : (
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#dc3545' }}>
              ⚠️ Tidak ada entitas yang aktif
            </p>
          )}
        </div>

        <button
          onClick={() => {
            setEditingBudget(null);
            setShowForm(true);
          }}
          disabled={!activeEntity || loading}
          style={{
            padding: '10px 20px',
            backgroundColor: activeEntity && !loading ? '#007bff' : '#adb5bd',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: activeEntity && !loading ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          + Tambah Budget
        </button>
      </div>

      {/* No Active Entity Warning */}
      {!activeEntity && (
        <div style={{
          padding: '20px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          marginBottom: '16px',
          textAlign: 'center',
        }}>
          <h3 style={{ margin: '0 0 8px', color: '#856404' }}>⚠️ Belum Ada Entitas Aktif</h3>
          <p style={{ margin: '0 0 12px', color: '#856404' }}>
            Silakan pilih entitas terlebih dahulu di halaman <strong>Manajemen Entitas</strong>
          </p>
          <a
            href="/entities"
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

      {/* Budget Form */}
      {showForm && activeEntity && (
        <div style={{ marginBottom: '24px' }}>
          <BudgetForm
            mode={editingBudget ? 'edit' : 'create'}
            budget={editingBudget || undefined}
            items={editingBudget?.items || []}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </div>
      )}

      {/* Filters - TETAP SEPERTI SEKARANG */}
      {activeEntity && !showForm && (
        <div style={{
          padding: '20px 24px',
          backgroundColor: 'white',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          marginBottom: '16px',
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '150px 250px 150px 200px 200px',
            gap: '16px', 
            alignItems: 'end',
            marginBottom: '12px',
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>
                Filter Tahun
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                <option value="all">Semua Tahun</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: 'span 4' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>
                Cari Budget
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, periode, atau deskripsi..."
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>

          <div style={{ fontSize: '13px', color: '#6c757d' }}>
            Menampilkan <strong>{filteredBudgets.length}</strong> dari {budgets.length} budget
          </div>
        </div>
      )}

      {/* Budget List */}
      {activeEntity && !showForm && (
        <div>
          {loading && budgets.length === 0 ? (
            <div style={{
              padding: '60px 20px',
              textAlign: 'center',
              backgroundColor: 'white',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              color: '#6c757d',
            }}>
              ⏳ Memuat data budget...
            </div>
          ) : filteredBudgets.length === 0 ? (
            <div style={{
              padding: '60px 20px',
              textAlign: 'center',
              backgroundColor: 'white',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              color: '#6c757d',
            }}>
              {searchQuery ? (
                <>
                  🔍 Tidak ada budget yang cocok dengan pencarian "<strong>{searchQuery}</strong>"
                </>
              ) : (
                <>
                  📋 Belum ada budget. Klik tombol "Tambah Budget" untuk membuat budget baru.
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredBudgets.map((budget) => {
                const isExpanded = expandedBudgets.has(budget.id);
                const budgetDetails = expandedBudgets.get(budget.id);

                return (
                  <div
                    key={budget.id}
                    style={{
                      backgroundColor: 'white',
                      border: '1px solid #dee2e6',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Budget Header - FIXED WIDTH */}
                    <div
                      style={{
                        padding: '20px 24px',
                        backgroundColor: '#f8f9fa',
                        borderBottom: '1px solid #dee2e6',
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleExpandBudget(budget.id)}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '24px',
                      }}>
                        {/* Budget Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                            <h3 style={{
                              margin: 0,
                              fontSize: '18px',
                              fontWeight: 600,
                              color: '#212529',
                            }}>
                              📊 {budget.name}
                            </h3>
                            <span style={{
                              padding: '4px 10px',
                              backgroundColor: '#e7f3ff',
                              color: '#004085',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}>
                              {budget.period}
                            </span>
                          </div>
                          <div style={{
                            fontSize: '13px',
                            color: '#6c757d',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {budget.description || 'Tidak ada deskripsi'}
                            {budgetDetails && ` • ${budgetDetails.items.length} akun`}
                          </div>
                        </div>

                        {/* Total Budget */}
                        <div style={{ width: '180px', textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '11px', color: '#6c757d', marginBottom: '2px', textTransform: 'uppercase', fontWeight: 600 }}>
                            Total Budget
                          </div>
                          <div style={{ 
                            fontSize: `${getAdaptiveFontSize(budget.total_budget)}px`, 
                            fontWeight: 600, 
                            color: '#212529' 
                          }}>
                            Rp {formatCurrency(budget.total_budget)}
                          </div>
                        </div>

                        {/* Expand Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpandBudget(budget.id);
                          }}
                          style={{
                            width: '40px',
                            height: '40px',
                            flexShrink: 0,
                            backgroundColor: '#e9ecef',
                            color: '#495057',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            transition: 'transform 0.2s',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          ▼
                        </button>
                      </div>
                    </div>

                    {/* Budget Details (Expanded) */}
                    {isExpanded && budgetDetails && (
                      <div style={{ padding: '20px 24px' }}>
                        {/* Summary */}
                        <div style={{
                          padding: '16px',
                          backgroundColor:
                            budgetDetails.status === 'OVER_BUDGET'
                              ? '#fff3cd'
                              : budgetDetails.status === 'FULLY_ALLOCATED'
                              ? '#d4edda'
                              : '#d1ecf1',
                          border: `1px solid ${
                            budgetDetails.status === 'OVER_BUDGET'
                              ? '#ffc107'
                              : budgetDetails.status === 'FULLY_ALLOCATED'
                              ? '#c3e6cb'
                              : '#bee5eb'
                          }`,
                          borderRadius: '6px',
                          marginBottom: '16px',
                        }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
                            <div>
                              <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>
                                Total Budget
                              </div>
                              <div style={{ 
                                fontSize: `${getAdaptiveFontSize(budgetDetails.total_budget)}px`, 
                                fontWeight: 600 
                              }}>
                                Rp {formatCurrency(budgetDetails.total_budget)}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>
                                Total Alokasi
                              </div>
                              <div style={{ 
                                fontSize: `${getAdaptiveFontSize(budgetDetails.total_allocated)}px`, 
                                fontWeight: 600 
                              }}>
                                Rp {formatCurrency(budgetDetails.total_allocated)}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>
                                Sisa
                              </div>
                              <div style={{
                                fontSize: `${getAdaptiveFontSize(Math.abs(budgetDetails.remaining_budget))}px`,
                                fontWeight: 600,
                                color:
                                  budgetDetails.status === 'OVER_BUDGET'
                                    ? '#dc3545'
                                    : budgetDetails.status === 'FULLY_ALLOCATED'
                                    ? '#28a745'
                                    : '#0066cc',
                              }}>
                                Rp {formatCurrency(budgetDetails.remaining_budget)}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>
                                Status
                              </div>
                              <div style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                padding: '6px 12px',
                                borderRadius: '12px',
                                display: 'inline-block',
                                backgroundColor:
                                  budgetDetails.status === 'OVER_BUDGET'
                                    ? '#dc3545'
                                    : budgetDetails.status === 'FULLY_ALLOCATED'
                                    ? '#28a745'
                                    : '#17a2b8',
                                color: 'white',
                              }}>
                                {budgetDetails.status === 'OVER_BUDGET'
                                  ? '⚠️ Over'
                                  : budgetDetails.status === 'FULLY_ALLOCATED'
                                  ? '✓ Penuh'
                                  : '○ Tersedia'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                          <button
                            onClick={() => handleEditBudget(budget.id)}
                            disabled={loading}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              fontSize: '14px',
                              fontWeight: 500,
                            }}
                          >
                            ✏️ Edit
                          </button>

                          <button
                            onClick={() => handleDeleteBudget(budget.id, budget.name)}
                            disabled={loading}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              fontSize: '14px',
                              fontWeight: 500,
                            }}
                          >
                            🗑️ Hapus
                          </button>
                        </div>

                        {/* Items Table */}
                        {budgetDetails.items.length === 0 ? (
                          <div style={{
                            padding: '40px 20px',
                            textAlign: 'center',
                            backgroundColor: '#f8f9fa',
                            border: '1px solid #dee2e6',
                            borderRadius: '6px',
                            color: '#6c757d',
                          }}>
                            Belum ada alokasi akun. Klik "Edit" untuk menambahkan.
                          </div>
                        ) : (
                          <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '6px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#f8f9fa' }}>
                                  <th style={tableHeaderStyle}>Kode Akun</th>
                                  <th style={tableHeaderStyle}>Nama Akun</th>
                                  <th style={tableHeaderStyle}>Tipe</th>
                                  <th style={tableHeaderStyle}>Alokasi</th>
                                  <th style={tableHeaderStyle}>Catatan</th>
                                </tr>
                              </thead>
                              <tbody>
                                {budgetDetails.items.map((item) => (
                                  <tr key={item.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                                    <td style={tableCellStyle}>
                                      <code style={{
                                        padding: '4px 8px',
                                        backgroundColor: '#e7f3ff',
                                        borderRadius: '4px',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                      }}>
                                        {item.account_code}
                                      </code>
                                    </td>
                                    <td style={tableCellStyle}>
                                      <div style={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        maxWidth: '300px',
                                      }}>
                                        {item.account_name}
                                      </div>
                                    </td>
                                    <td style={tableCellStyle}>
                                      <span style={{
                                        padding: '4px 8px',
                                        backgroundColor: '#e7f3ff',
                                        color: '#004085',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                      }}>
                                        {item.account_type}
                                      </span>
                                    </td>
                                    <td style={tableCellStyle}>
                                      <strong style={{
                                        fontSize: `${getAdaptiveFontSize(item.allocated_amount)}px`,
                                      }}>
                                        Rp {formatCurrency(item.allocated_amount)}
                                      </strong>
                                    </td>
                                    <td style={tableCellStyle}>
                                      <div style={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        maxWidth: '200px',
                                        color: '#6c757d',
                                        fontSize: '13px',
                                      }}>
                                        {item.description || '-'}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const tableHeaderStyle: React.CSSProperties = {
  padding: '14px 16px',
  textAlign: 'left',
  fontSize: '13px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#495057',
  borderBottom: '2px solid #dee2e6',
  borderRight: '1px solid #dee2e6',
};

const tableCellStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: '14px',
  color: '#212529',
  borderRight: '1px solid #dee2e6',
};

export default BudgetPage;