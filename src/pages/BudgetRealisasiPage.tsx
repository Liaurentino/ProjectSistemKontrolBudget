import React, { useState, useEffect } from 'react';
import { useEntity } from '../contexts/EntityContext';
import {
  getBudgetRealizationsLive,
  getAvailableRealizationPeriods,
  getAvailableAccountTypes,
  getAvailableBudgetGroups,
  subscribeBudgetItems,
  type BudgetRealization,
  type BudgetRealizationSummary,
} from '../lib/accurate';
import { ExportFile } from '../components/ExportFile';

// Helper: Format currency
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('id-ID');
};

// Helper: Get adaptive font size
const getAdaptiveFontSize = (amount: number): number => {
  if (amount >= 1_000_000_000_000) return 14;
  if (amount >= 1_000_000_000) return 15;
  return 16;
};

// Interface untuk grouped data
interface GroupedBudgetRealization {
  budget_group_name: string;
  period: string;
  total_budget: number;
  total_realisasi: number;
  total_variance: number;
  variance_percentage: number;
  status: 'ON_TRACK' | 'OVER_BUDGET';
  accounts: BudgetRealization[]; // Detail akun-akun dalam group ini
}

const BudgetRealizationPage: React.FC = () => {
  const { activeEntity } = useEntity();

  // State
  const [realizations, setRealizations] = useState<BudgetRealization[]>([]);
  const [groupedData, setGroupedData] = useState<GroupedBudgetRealization[]>([]);
  const [summary, setSummary] = useState<BudgetRealizationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedGroup, setSelectedGroup] = useState<GroupedBudgetRealization | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Filters
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [selectedAccountType, setSelectedAccountType] = useState<string>('all');
  const [selectedBudgetGroup, setSelectedBudgetGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Available options
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableBudgetGroups, setAvailableBudgetGroups] = useState<string[]>([]);

  // Load available filters
  useEffect(() => {
    if (activeEntity?.id) {
      loadAvailableFilters();
    }
  }, [activeEntity?.id]);

  const loadAvailableFilters = async () => {
    if (!activeEntity) return;

    const { data: periods } = await getAvailableRealizationPeriods(activeEntity.id);
    const { data: types } = await getAvailableAccountTypes(activeEntity.id);
    const { data: groups } = await getAvailableBudgetGroups(activeEntity.id);

    setAvailablePeriods(periods || []);
    setAvailableTypes(types || []);
    setAvailableBudgetGroups(groups || []);
  };

  // Load data
  useEffect(() => {
    if (activeEntity?.id) {
      loadData();
    } else {
      setRealizations([]);
      setGroupedData([]);
      setSummary(null);
    }
  }, [activeEntity?.id, selectedPeriod, selectedAccountType, selectedBudgetGroup]);

  const loadData = async () => {
    if (!activeEntity) return;

    setLoading(true);
    setError(null);

    try {
      const period = selectedPeriod === 'all' ? undefined : selectedPeriod;
      const accountType = selectedAccountType === 'all' ? undefined : selectedAccountType;
      const budgetName = selectedBudgetGroup === 'all' ? undefined : selectedBudgetGroup;

      // Load realizations with live data from accurate_accounts
      const { data: realizationsData, error: realizationsError } = await getBudgetRealizationsLive(
        activeEntity.id,
        period,
        accountType,
        budgetName
      );

      if (realizationsError) throw realizationsError;

      setRealizations(realizationsData || []);

      // Group data by budget_group_name and period
      const grouped = groupRealizationsByBudgetGroup(realizationsData || []);
      setGroupedData(grouped);

      // Calculate summary from loaded data
      const summaryData = calculateSummary(realizationsData || [], activeEntity, period);
      setSummary(summaryData);

      console.log('[BudgetRealizationPage] Loaded', realizationsData?.length || 0, 'realizations');
      console.log('[BudgetRealizationPage] Grouped into', grouped.length, 'budget groups');
    } catch (err: any) {
      console.error('[BudgetRealizationPage] Error loading data:', err);
      setError('Gagal memuat data realisasi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Group realizations by budget name (from budgets.name) and period
  const groupRealizationsByBudgetGroup = (data: BudgetRealization[]): GroupedBudgetRealization[] => {
    const groupMap = new Map<string, BudgetRealization[]>();

    // Group by budgets.name + period
    data.forEach(item => {
      // Get budget name from budgets.name
      const budgetName = item.budgets?.name || 'Unknown Budget';
      const key = `${budgetName}|||${item.period}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(item);
    });

    // Convert to array and calculate totals
    const grouped: GroupedBudgetRealization[] = [];
    groupMap.forEach((accounts, key) => {
      const [budgetGroupName, period] = key.split('|||');
      
      const totalBudget = accounts.reduce((sum, acc) => sum + acc.budget_allocated, 0);
      const totalRealisasi = accounts.reduce((sum, acc) => sum + acc.realisasi, 0);
      const totalVariance = totalBudget - totalRealisasi;
      const variancePercentage = totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0;
      const status = totalRealisasi <= totalBudget ? 'ON_TRACK' : 'OVER_BUDGET';

      grouped.push({
        budget_group_name: budgetGroupName,
        period,
        total_budget: totalBudget,
        total_realisasi: totalRealisasi,
        total_variance: totalVariance,
        variance_percentage: variancePercentage,
        status,
        accounts,
      });
    });

    return grouped;
  };

  // Calculate summary from realizations data
  const calculateSummary = (
    data: BudgetRealization[], 
    entity: any, 
    period?: string
  ): BudgetRealizationSummary | null => {
    if (!data || data.length === 0) return null;

    const totalBudget = data.reduce((sum, item) => sum + item.budget_allocated, 0);
    const totalRealisasi = data.reduce((sum, item) => sum + item.realisasi, 0);
    const totalVariance = totalBudget - totalRealisasi;
    const variancePercentage = totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0;
    const overallStatus = totalRealisasi <= totalBudget ? 'ON_TRACK' : 'OVER_BUDGET';
    const onTrackCount = data.filter(item => item.status === 'ON_TRACK').length;
    const overBudgetCount = data.filter(item => item.status === 'OVER_BUDGET').length;

    return {
      entity_id: entity.id,
      entity_name: entity.entity_name || entity.name,
      period: period || 'all',
      total_accounts: data.length,
      total_budgets: [...new Set(data.map(item => item.budget_id))].length,
      total_budget: totalBudget,
      total_realisasi: totalRealisasi,
      total_variance: totalVariance,
      variance_percentage: variancePercentage,
      overall_status: overallStatus,
      on_track_count: onTrackCount,
      over_budget_count: overBudgetCount,
      last_updated: new Date().toISOString(),
    };
  };

  // Setup real-time subscription
  useEffect(() => {
    if (!activeEntity?.id) return;

    console.log('[BudgetRealizationPage] Setting up subscription...');

    const subscription = subscribeBudgetItems(activeEntity.id, () => {
      console.log('[BudgetRealizationPage] Real-time update detected');
      loadData();
    });

    return () => {
      console.log('[BudgetRealizationPage] Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, [activeEntity?.id]);

  // Filter by search (search in budget name from budgets.name)
  const filteredGroupedData = groupedData.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return item.budget_group_name.toLowerCase().includes(query);
  });

  // Open detail modal
  const handleOpenDetail = (group: GroupedBudgetRealization) => {
    setSelectedGroup(group);
    setShowDetailModal(true);
  };

  // Close detail modal
  const handleCloseDetail = () => {
    setShowDetailModal(false);
    setSelectedGroup(null);
  };

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
          <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }}>Laporan Perbandingan</h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6c757d' }}>
            Budget vs Realisasi per Budget Group
          </p>
          {activeEntity && (
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6c757d' }}>
              Entitas: <strong>{activeEntity.entity_name || activeEntity.name}</strong>
            </p>
          )}
        </div>

        <button
          onClick={loadData}
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
          {loading ? '⏳ Memuat...' : '🔄 Refresh Data'}
        </button>
      </div>

      {/* No Entity Warning */}
      {!activeEntity && (
        <div style={{
          padding: '20px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          marginBottom: '16px',
          textAlign: 'center',
        }}>
          <h3 style={{ margin: '0 0 8px', color: '#856404' }}>Belum Ada Entitas Aktif</h3>
          <p style={{ margin: 0, color: '#856404' }}>
            Silakan pilih entitas terlebih dahulu di halaman Manajemen Entitas
          </p>
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

      {/* Filters */}
      {activeEntity && (
        <div style={{
          padding: '20px 24px',
          backgroundColor: 'white',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          marginBottom: '16px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Filter Laporan</h3>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '16px',
          }}>
            {/* Periode */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '13px',
                fontWeight: 500,
              }}>
                Periode
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                <option value="all">Semua Periode</option>
                {availablePeriods.map((period) => (
                  <option key={period} value={period}>{period}</option>
                ))}
              </select>
            </div>

            {/* Nama Budget */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '13px',
                fontWeight: 500,
              }}>
                Nama Budget
              </label>
              <select
                value={selectedBudgetGroup}
                onChange={(e) => setSelectedBudgetGroup(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                <option value="all">Semua Budget</option>
                {availableBudgetGroups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>

            {/* Tipe Akun */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '13px',
                fontWeight: 500,
              }}>
                Tipe Akun
              </label>
              <select
                value={selectedAccountType}
                onChange={(e) => setSelectedAccountType(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                <option value="all">Semua Tipe</option>
                {availableTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '13px',
                fontWeight: 500,
              }}>
                Cari Budget Group
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama budget group..."
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
            Menampilkan <strong>{filteredGroupedData.length}</strong> dari {groupedData.length} budget group
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {activeEntity && summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}>
          {/* Total Budget */}
          <div style={{
            padding: '20px',
            backgroundColor: '#007bff',
            color: 'white',
            borderRadius: '8px',
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '8px',
              textTransform: 'uppercase',
              opacity: 0.9,
            }}>
              Total Budget
            </div>
            <div style={{
              fontSize: `${getAdaptiveFontSize(summary.total_budget)}px`,
              fontWeight: 600,
            }}>
              Rp{formatCurrency(summary.total_budget)}
            </div>
          </div>

          {/* Total Realisasi */}
          <div style={{
            padding: '20px',
            backgroundColor: '#28a745',
            color: 'white',
            borderRadius: '8px',
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '8px',
              textTransform: 'uppercase',
              opacity: 0.9,
            }}>
              Total Realisasi
            </div>
            <div style={{
              fontSize: `${getAdaptiveFontSize(summary.total_realisasi)}px`,
              fontWeight: 600,
            }}>
              Rp{formatCurrency(summary.total_realisasi)}
            </div>
          </div>

          {/* Variance */}
          <div style={{
            padding: '20px',
            backgroundColor: summary.overall_status === 'OVER_BUDGET' ? '#dc3545' : '#17a2b8',
            color: 'white',
            borderRadius: '8px',
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '8px',
              textTransform: 'uppercase',
              opacity: 0.9,
            }}>
              Variance
            </div>
            <div style={{
              fontSize: `${getAdaptiveFontSize(Math.abs(summary.total_variance))}px`,
              fontWeight: 600,
            }}>
              Rp{formatCurrency(Math.abs(summary.total_variance))}
            </div>
            <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.9 }}>
              {summary.overall_status === 'OVER_BUDGET' ? 'Over Budget' : 'Under Budget'}
            </div>
          </div>

          {/* Variance % */}
          <div style={{
            padding: '20px',
            backgroundColor: summary.overall_status === 'OVER_BUDGET' ? '#dc3545' : '#28a745',
            color: 'white',
            borderRadius: '8px',
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '8px',
              textTransform: 'uppercase',
              opacity: 0.9,
            }}>
              Variance %
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600 }}>
              {Math.abs(summary.variance_percentage).toFixed(2)}%
            </div>
            <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.9 }}>
              Sisa Budget
            </div>
          </div>
        </div>
      )}

      {/* Grouped Data Table */}
      {activeEntity && (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          {loading && groupedData.length === 0 ? (
            <div style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: '#6c757d',
            }}>
              ⏳ Memuat data...
            </div>
          ) : filteredGroupedData.length === 0 ? (
            <div style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: '#6c757d',
            }}>
              {searchQuery ? (
                <>🔍 Tidak ada data yang cocok dengan pencarian "<strong>{searchQuery}</strong>"</>
              ) : (
                <>📋 Belum ada data realisasi. Pastikan sudah ada budget dan akun accurate tersedia.</>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={tableHeaderStyle}>Entitas</th>
                    <th style={tableHeaderStyle}>Periode</th>
                    <th style={tableHeaderStyle}>Nama Budget Group</th>
                    <th style={tableHeaderStyle}>Total Budget</th>
                    <th style={tableHeaderStyle}>Total Realisasi</th>
                    <th style={tableHeaderStyle}>Variance</th>
                    <th style={tableHeaderStyle}>Variance %</th>
                    <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Status</th>
                    <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroupedData.map((group, index) => (
                    <tr key={`${group.budget_group_name}-${group.period}-${index}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={tableCellStyle}>
                        {activeEntity.entity_name || activeEntity.name}
                      </td>
                      <td style={tableCellStyle}>
                        <code style={{
                          padding: '4px 8px',
                          backgroundColor: '#e7f3ff',
                          borderRadius: '4px',
                          fontSize: '13px',
                        }}>
                          {group.period}
                        </code>
                      </td>
                      <td style={tableCellStyle}>
                        <div style={{
                          fontWeight: 600,
                          color: '#007bff',
                        }}>
                          {group.budget_group_name}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#6c757d',
                          marginTop: '2px',
                        }}>
                          {group.accounts.length} akun
                        </div>
                      </td>
                      <td style={tableCellStyle}>
                        <strong style={{
                          fontSize: `${getAdaptiveFontSize(group.total_budget)}px`,
                        }}>
                          Rp{formatCurrency(group.total_budget)}
                        </strong>
                      </td>
                      <td style={tableCellStyle}>
                        <strong style={{
                          fontSize: `${getAdaptiveFontSize(group.total_realisasi)}px`,
                          color: '#28a745',
                        }}>
                          Rp{formatCurrency(group.total_realisasi)}
                        </strong>
                      </td>
                      <td style={tableCellStyle}>
                        <strong style={{
                          fontSize: `${getAdaptiveFontSize(Math.abs(group.total_variance))}px`,
                          color: group.total_variance >= 0 ? '#28a745' : '#dc3545',
                        }}>
                          Rp{formatCurrency(Math.abs(group.total_variance))}
                        </strong>
                      </td>
                      <td style={tableCellStyle}>
                        <strong style={{
                          fontSize: '14px',
                          color: group.total_variance >= 0 ? '#28a745' : '#dc3545',
                        }}>
                          {Math.abs(group.variance_percentage).toFixed(2)}%
                        </strong>
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                        <span style={{
                          padding: '6px 12px',
                          backgroundColor: group.status === 'ON_TRACK' ? '#d4edda' : '#f8d7da',
                          color: group.status === 'ON_TRACK' ? '#155724' : '#721c24',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}>
                          {group.status === 'ON_TRACK' ? '✓ On Track' : '⚠ Over Budget'}
                        </span>
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                        <button
                          onClick={() => handleOpenDetail(group)}
                          style={{
                            padding: '6px 16px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                          }}
                        >
                          📋 Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedGroup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            maxWidth: '1200px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
         <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #dee2e6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
                  Detail Akun - {selectedGroup.budget_group_name}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6c757d' }}>
                  Periode: {selectedGroup.period} • {selectedGroup.accounts.length} akun
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {/* Export Buttons */}
                <ExportFile
                  group={{
                    budget_name: selectedGroup.budget_group_name,
                    period: selectedGroup.period,
                    accounts: selectedGroup.accounts,
                    total_budget: selectedGroup.total_budget,
                    total_realisasi: selectedGroup.total_realisasi,
                    total_variance: selectedGroup.total_variance,
                    variance_percentage: selectedGroup.variance_percentage,
                    overall_status: selectedGroup.status,
                  }}
                  entityName={activeEntity?.entity_name || activeEntity?.name || 'Unknown'}
                />
                
                {/* Close Button */}
                <button
                  onClick={handleCloseDetail}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '18px',
                    fontWeight: 600,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{
              padding: '20px 24px',
              overflowY: 'auto',
              flex: 1,
            }}>
              {/* Summary Cards for this group */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                marginBottom: '20px',
              }}>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  borderRadius: '6px',
                }}>
                  <div style={{ fontSize: '11px', marginBottom: '6px', opacity: 0.9 }}>
                    TOTAL BUDGET
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>
                    Rp{formatCurrency(selectedGroup.total_budget)}
                  </div>
                </div>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  borderRadius: '6px',
                }}>
                  <div style={{ fontSize: '11px', marginBottom: '6px', opacity: 0.9 }}>
                    TOTAL REALISASI
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>
                    Rp{formatCurrency(selectedGroup.total_realisasi)}
                  </div>
                </div>
                   <div style={{
                  padding: '16px',
                  backgroundColor: selectedGroup.status === 'OVER_BUDGET' ? '#dc3545' : '#17a2b8',
                  color: 'white',
                  borderRadius: '6px',
                }}>
                  <div style={{ fontSize: '11px', marginBottom: '6px', opacity: 0.9 }}>
                    VARIANCE
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>
                    Rp{formatCurrency(Math.abs(selectedGroup.total_variance))}
                  </div>
                </div>
                <div style={{
                  padding: '16px',
                  backgroundColor: selectedGroup.status === 'OVER_BUDGET' ? '#dc3545' : '#28a745',
                  color: 'white',
                  borderRadius: '6px',
                }}>
                  <div style={{ fontSize: '11px', marginBottom: '6px', opacity: 0.9 }}>
                    VARIANCE %
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>
                    {Math.abs(selectedGroup.variance_percentage).toFixed(2)}%
                  </div>
                  <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.9 }}>
                    {selectedGroup.status === 'OVER_BUDGET' ? 'Over Budget' : 'Sisa Budget'}
                  </div>
                </div>
              </div>

              {/* Detail Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={tableHeaderStyle}>Kode Akun</th>
                      <th style={tableHeaderStyle}>Nama Akun</th>
                      <th style={tableHeaderStyle}>Tipe</th>
                      <th style={tableHeaderStyle}>Budget</th>
                      <th style={tableHeaderStyle}>Realisasi</th>
                      <th style={tableHeaderStyle}>Variance</th>
                      <th style={tableHeaderStyle}>Variance %</th>
                      <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGroup.accounts.map((account) => (
                      <tr key={account.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                        <td style={tableCellStyle}>
                          <code style={{
                            padding: '4px 8px',
                            backgroundColor: '#e7f3ff',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontWeight: 500,
                          }}>
                            {account.account_code}
                          </code>
                        </td>
                        <td style={tableCellStyle}>
                          <div style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '250px',
                          }}>
                            {account.account_name}
                          </div>
                        </td>
                        <td style={tableCellStyle}>
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: '#f0f0f0',
                            borderRadius: '4px',
                            fontSize: '12px',
                          }}>
                            {account.account_type || '-'}
                          </span>
                        </td>
                        <td style={tableCellStyle}>
                          <strong style={{
                            fontSize: `${getAdaptiveFontSize(account.budget_allocated)}px`,
                          }}>
                            Rp{formatCurrency(account.budget_allocated)}
                          </strong>
                        </td>
                        <td style={tableCellStyle}>
                          <strong style={{
                            fontSize: `${getAdaptiveFontSize(account.realisasi)}px`,
                            color: '#28a745',
                          }}>
                            Rp{formatCurrency(account.realisasi)}
                          </strong>
                        </td>
                        <td style={tableCellStyle}>
                          <strong style={{
                            fontSize: `${getAdaptiveFontSize(Math.abs(account.variance))}px`,
                            color: account.variance >= 0 ? '#28a745' : '#dc3545',
                          }}>
                            Rp{formatCurrency(Math.abs(account.variance))}
                          </strong>
                        </td>
                        <td style={tableCellStyle}>
                          <strong style={{
                            fontSize: '14px',
                            color: account.variance >= 0 ? '#28a745' : '#dc3545',
                          }}>
                            {Math.abs(account.variance_percentage).toFixed(2)}%
                          </strong>
                        </td>
                        <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                          <span style={{
                            padding: '6px 12px',
                            backgroundColor: account.status === 'ON_TRACK' ? '#d4edda' : '#f8d7da',
                            color: account.status === 'ON_TRACK' ? '#155724' : '#721c24',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}>
                            {account.status === 'ON_TRACK' ? '✓ On Track' : '⚠ Over Budget'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #dee2e6',
              display: 'flex',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={handleCloseDetail}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Tutup
              </button>
            </div>
          </div>
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

export default BudgetRealizationPage;