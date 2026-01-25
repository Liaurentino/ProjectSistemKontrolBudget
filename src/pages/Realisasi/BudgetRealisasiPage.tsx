import React, { useState, useEffect } from 'react';
import { useEntity } from '../../contexts/EntityContext';
import {
  getBudgetRealizationsLive,
  getAvailableRealizationPeriods,
  getAvailableAccountTypes,
  subscribeBudgetItems,
  type BudgetRealization,
  type BudgetRealizationSummary,
} from '../../lib/accurate';
import { ExportFile } from '../../components/Export&Import/ExportFile';
import styles from './BudgetRealisasiPage.module.css';

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
  accounts: BudgetRealization[];
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

  // Filters - CHANGED: Period is now required, no default 'all'
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedAccountType, setSelectedAccountType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Available options
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);

  // NEW: Track if data has been loaded (user has selected period)
  const [hasSelectedPeriod, setHasSelectedPeriod] = useState(false);

  // Load available periods on mount
  useEffect(() => {
    if (activeEntity?.id) {
      loadAvailablePeriods();
    }
  }, [activeEntity?.id]);

  const loadAvailablePeriods = async () => {
    if (!activeEntity) return;

    const { data: periods } = await getAvailableRealizationPeriods(activeEntity.id);
    setAvailablePeriods(periods || []);
  };

  // Load available account types when period is selected
  useEffect(() => {
    if (activeEntity?.id && selectedPeriod) {
      loadAvailableAccountTypes();
    }
  }, [activeEntity?.id, selectedPeriod]);

  const loadAvailableAccountTypes = async () => {
    if (!activeEntity || !selectedPeriod) return;

    const { data: types } = await getAvailableAccountTypes(activeEntity.id, selectedPeriod);
    setAvailableTypes(types || []);
  };

  // Load data ONLY when period is selected
  useEffect(() => {
    if (activeEntity?.id && selectedPeriod) {
      loadData();
      setHasSelectedPeriod(true);
    } else {
      // Reset data when no period selected
      setRealizations([]);
      setGroupedData([]);
      setSummary(null);
      setHasSelectedPeriod(false);
    }
  }, [activeEntity?.id, selectedPeriod, selectedAccountType]);

  const loadData = async () => {
    if (!activeEntity || !selectedPeriod) return;

    setLoading(true);
    setError(null);

    try {
      const accountType = selectedAccountType === 'all' ? undefined : selectedAccountType;

      const { data: realizationsData, error: realizationsError } = await getBudgetRealizationsLive(
        activeEntity.id,
        selectedPeriod,
        accountType,
        undefined // budgetName removed
      );

      if (realizationsError) throw realizationsError;

      setRealizations(realizationsData || []);
      const grouped = groupRealizationsByBudgetGroup(realizationsData || []);
      setGroupedData(grouped);
      const summaryData = calculateSummary(realizationsData || [], activeEntity, selectedPeriod);
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

  // Group realizations by budget name and period
  const groupRealizationsByBudgetGroup = (data: BudgetRealization[]): GroupedBudgetRealization[] => {
    const groupMap = new Map<string, BudgetRealization[]>();

    data.forEach(item => {
      const budgetName = item.budgets?.name || 'Unknown Budget';
      const key = `${budgetName}|||${item.period}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(item);
    });

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

  // Calculate summary
  const calculateSummary = (
    data: BudgetRealization[], 
    entity: any, 
    period: string
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
      period: period,
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
    if (!activeEntity?.id || !selectedPeriod) return;

    const subscription = subscribeBudgetItems(activeEntity.id, () => {
      loadData();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [activeEntity?.id, selectedPeriod]);

  // Filter by search
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
    <div className={styles.pageContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2>Laporan Perbandingan</h2>
          <p>Budget vs Realisasi per Budget Group</p>
          {activeEntity && (
            <p>
              Entitas: <strong>{activeEntity.entity_name || activeEntity.name}</strong>
            </p>
          )}
        </div>

        <button
          onClick={loadData}
          disabled={!activeEntity || !selectedPeriod || loading}
          className={`${styles.refreshButton} ${
            activeEntity && selectedPeriod && !loading ? styles.active : styles.disabled
          }`}
        >
          {loading ? '⏳ Memuat...' : '🔄 Refresh Data'}
        </button>
      </div>

      {/* No Entity Warning */}
      {!activeEntity && (
        <div className={styles.noEntityWarning}>
          <h3>Belum Ada Entitas Aktif</h3>
          <p>
            Silakan pilih entitas terlebih dahulu di halaman Manajemen Entitas
          </p>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className={styles.errorAlert}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Filters - UPDATED: Period is required */}
      {activeEntity && (
        <div className={styles.filterSection}>
          <div className={styles.filterHeader}>
            <h3>Filter Laporan</h3>
            {!selectedPeriod && (
              <p style={{ color: '#dc3545', fontSize: '14px', marginTop: '8px' }}>
                ⚠️ Pilih periode untuk melihat data
              </p>
            )}
          </div>

          <div className={styles.filterGrid}>
            {/* Periode - REQUIRED */}
            <div>
              <label className={styles.filterLabel}>
                Periode <span style={{ color: '#dc3545' }}>*</span>
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                disabled={loading}
                className={styles.filterSelect}
              >
                <option value="">-- Pilih Periode --</option>
                {availablePeriods.map((period) => (
                  <option key={period} value={period}>{period}</option>
                ))}
              </select>
            </div>

            {/* Tipe Akun */}
            <div>
              <label className={styles.filterLabel}>Tipe Akun</label>
              <select
                value={selectedAccountType}
                onChange={(e) => setSelectedAccountType(e.target.value)}
                disabled={loading || !selectedPeriod}
                className={styles.filterSelect}
              >
                <option value="all">Semua Tipe</option>
                {availableTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div>
              <label className={styles.filterLabel}>Cari Budget Group</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama budget group..."
                disabled={loading || !selectedPeriod}
                className={styles.filterInput}
              />
            </div>
          </div>

          {hasSelectedPeriod && (
            <div className={styles.filterInfo}>
              Menampilkan <strong>{filteredGroupedData.length}</strong> dari {groupedData.length} budget group
            </div>
          )}
        </div>
      )}

      {/* Summary Cards - ONLY show if period is selected */}
      {activeEntity && summary && selectedPeriod && (
        <div className={styles.summaryCards}>
          <div className={`${styles.summaryCard} ${styles.blue}`}>
            <div className={styles.summaryCardLabel}>Total Budget</div>
            <div 
              className={styles.summaryCardValue}
              style={{ fontSize: `${getAdaptiveFontSize(summary.total_budget)}px` }}
            >
              Rp{formatCurrency(summary.total_budget)}
            </div>
          </div>

          <div className={`${styles.summaryCard} ${styles.green}`}>
            <div className={styles.summaryCardLabel}>Total Realisasi</div>
            <div 
              className={styles.summaryCardValue}
              style={{ fontSize: `${getAdaptiveFontSize(summary.total_realisasi)}px` }}
            >
              Rp{formatCurrency(summary.total_realisasi)}
            </div>
          </div>

          <div className={`${styles.summaryCard} ${
            summary.overall_status === 'OVER_BUDGET' ? styles.red : styles.cyan
          }`}>
            <div className={styles.summaryCardLabel}>Variance</div>
            <div 
              className={styles.summaryCardValue}
              style={{ fontSize: `${getAdaptiveFontSize(Math.abs(summary.total_variance))}px` }}
            >
              Rp{formatCurrency(Math.abs(summary.total_variance))}
            </div>
            <div className={styles.summaryCardNote}>
              {summary.overall_status === 'OVER_BUDGET' ? 'Over Budget' : 'Under Budget'}
            </div>
          </div>

          <div className={`${styles.summaryCard} ${
            summary.overall_status === 'OVER_BUDGET' ? styles.red : styles.green
          }`}>
            <div className={styles.summaryCardLabel}>Variance %</div>
            <div className={styles.summaryCardValue} style={{ fontSize: '24px' }}>
              {Math.abs(summary.variance_percentage).toFixed(2)}%
            </div>
            <div className={styles.summaryCardNote}>Sisa Budget</div>
          </div>
        </div>
      )}

      {/* Grouped Data Table - ONLY show if period is selected */}
      {activeEntity && selectedPeriod && (
        <div className={styles.dataTableContainer}>
          {loading && groupedData.length === 0 ? (
            <div className={styles.loadingState}>⏳ Memuat data...</div>
          ) : !hasSelectedPeriod ? (
            <div className={styles.emptyState}>
              📅 Pilih periode untuk melihat laporan Budget vs Realisasi
            </div>
          ) : filteredGroupedData.length === 0 ? (
            <div className={styles.emptyState}>
              {searchQuery ? (
                <>🔍 Tidak ada data yang cocok dengan pencarian "<strong>{searchQuery}</strong>"</>
              ) : (
                <>📋 Belum ada data realisasi untuk periode ini. Pastikan sudah ada budget dan akun accurate tersedia.</>
              )}
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Entitas</th>
                    <th>Periode</th>
                    <th>Nama Budget Group</th>
                    <th>Total Budget</th>
                    <th>Total Realisasi</th>
                    <th>Variance</th>
                    <th>Variance %</th>
                    <th className={styles.center}>Status</th>
                    <th className={styles.center}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroupedData.map((group, index) => (
                    <tr key={`${group.budget_group_name}-${group.period}-${index}`}>
                      <td>{activeEntity.entity_name || activeEntity.name}</td>
                      <td>
                        <code className={styles.periodBadge}>{group.period}</code>
                      </td>
                      <td>
                        <div className={styles.budgetGroupName}>
                          {group.budget_group_name}
                        </div>
                        <div className={styles.budgetGroupMeta}>
                          {group.accounts.length} akun
                        </div>
                      </td>
                      <td>
                        <strong style={{
                          fontSize: `${getAdaptiveFontSize(group.total_budget)}px`,
                        }}>
                          Rp{formatCurrency(group.total_budget)}
                        </strong>
                      </td>
                      <td>
                        <strong style={{
                          fontSize: `${getAdaptiveFontSize(group.total_realisasi)}px`,
                          color: '#28a745',
                        }}>
                          Rp{formatCurrency(group.total_realisasi)}
                        </strong>
                      </td>
                      <td>
                        <strong style={{
                          fontSize: `${getAdaptiveFontSize(Math.abs(group.total_variance))}px`,
                          color: group.total_variance >= 0 ? '#28a745' : '#dc3545',
                        }}>
                          Rp{formatCurrency(Math.abs(group.total_variance))}
                        </strong>
                      </td>
                      <td>
                        <strong style={{
                          fontSize: '14px',
                          color: group.total_variance >= 0 ? '#28a745' : '#dc3545',
                        }}>
                          {Math.abs(group.variance_percentage).toFixed(2)}%
                        </strong>
                      </td>
                      <td className={styles.center}>
                        <span className={`${styles.statusBadge} ${
                          group.status === 'ON_TRACK' ? styles.onTrack : styles.overBudget
                        }`}>
                          {group.status === 'ON_TRACK' ? '✓ On Track' : '⚠ Over Budget'}
                        </span>
                      </td>
                      <td className={styles.center}>
                        <button
                          onClick={() => handleOpenDetail(group)}
                          className={styles.detailButton}
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

      {/* No Period Selected Message */}
      {activeEntity && !selectedPeriod && (
        <div className={styles.dataTableContainer}>
          <div className={styles.emptyState}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
            <h3>Pilih Periode Terlebih Dahulu</h3>
            <p style={{ marginTop: '8px', color: '#6c757d' }}>
              Silakan pilih periode di filter di atas untuk melihat laporan Budget vs Realisasi
            </p>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedGroup && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainer}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderContent}>
                <h3>Detail Akun - {selectedGroup.budget_group_name}</h3>
                <p>
                  Periode: {selectedGroup.period} • {selectedGroup.accounts.length} akun
                </p>
              </div>
              
              <div className={styles.modalHeaderActions}>
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
                
                <button
                  onClick={handleCloseDetail}
                  className={styles.modalCloseButton}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalSummaryCards}>
                <div className={`${styles.modalSummaryCard} ${styles.blue}`}>
                  <div className={styles.modalSummaryCardLabel}>TOTAL BUDGET</div>
                  <div className={styles.modalSummaryCardValue}>
                    Rp{formatCurrency(selectedGroup.total_budget)}
                  </div>
                </div>
                <div className={`${styles.modalSummaryCard} ${styles.green}`}>
                  <div className={styles.modalSummaryCardLabel}>TOTAL REALISASI</div>
                  <div className={styles.modalSummaryCardValue}>
                    Rp{formatCurrency(selectedGroup.total_realisasi)}
                  </div>
                </div>
                <div className={`${styles.modalSummaryCard} ${
                  selectedGroup.status === 'OVER_BUDGET' ? styles.red : styles.cyan
                }`}>
                  <div className={styles.modalSummaryCardLabel}>VARIANCE</div>
                  <div className={styles.modalSummaryCardValue}>
                    Rp{formatCurrency(Math.abs(selectedGroup.total_variance))}
                  </div>
                </div>
                <div className={`${styles.modalSummaryCard} ${
                  selectedGroup.status === 'OVER_BUDGET' ? styles.red : styles.green
                }`}>
                  <div className={styles.modalSummaryCardLabel}>VARIANCE %</div>
                  <div className={styles.modalSummaryCardValue}>
                    {Math.abs(selectedGroup.variance_percentage).toFixed(2)}%
                  </div>
                  <div className={styles.modalSummaryCardNote}>
                    {selectedGroup.status === 'OVER_BUDGET' ? 'Over Budget' : 'Sisa Budget'}
                  </div>
                </div>
              </div>

              <div className={styles.modalTableWrapper}>
                <table className={styles.modalTable}>
                  <thead>
                    <tr>
                      <th>Kode Akun</th>
                      <th>Nama Akun</th>
                      <th>Tipe</th>
                      <th>Budget</th>
                      <th>Realisasi</th>
                      <th>Variance</th>
                      <th>Variance %</th>
                      <th className={styles.center}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGroup.accounts.map((account) => (
                      <tr key={account.id}>
                        <td>
                          <code className={styles.accountCode}>
                            {account.account_code}
                          </code>
                        </td>
                        <td>
                          <div className={styles.accountName}>
                            {account.account_name}
                          </div>
                        </td>
                        <td>
                          <span className={styles.accountTypeBadge}>
                            {account.account_type || '-'}
                          </span>
                        </td>
                        <td>
                          <strong style={{
                            fontSize: `${getAdaptiveFontSize(account.budget_allocated)}px`,
                          }}>
                            Rp{formatCurrency(account.budget_allocated)}
                          </strong>
                        </td>
                        <td>
                          <strong style={{
                            fontSize: `${getAdaptiveFontSize(account.realisasi)}px`,
                            color: '#28a745',
                          }}>
                            Rp{formatCurrency(account.realisasi)}
                          </strong>
                        </td>
                        <td>
                          <strong style={{
                            fontSize: `${getAdaptiveFontSize(Math.abs(account.variance))}px`,
                            color: account.variance >= 0 ? '#28a745' : '#dc3545',
                          }}>
                            Rp{formatCurrency(Math.abs(account.variance))}
                          </strong>
                        </td>
                        <td>
                          <strong style={{
                            fontSize: '14px',
                            color: account.variance >= 0 ? '#28a745' : '#dc3545',
                          }}>
                            {Math.abs(account.variance_percentage).toFixed(2)}%
                          </strong>
                        </td>
                        <td className={styles.center}>
                          <span className={`${styles.statusBadge} ${
                            account.status === 'ON_TRACK' ? styles.onTrack : styles.overBudget
                          }`}>
                            {account.status === 'ON_TRACK' ? '✓ On Track' : '⚠ Over Budget'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                onClick={handleCloseDetail}
                className={styles.modalFooterButton}
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

export default BudgetRealizationPage;