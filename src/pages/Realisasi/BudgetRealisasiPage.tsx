import React, { useState, useEffect } from 'react';
import { useEntity } from '../../contexts/EntityContext';
import {
  getBudgetRealizationsLive,
  getAvailableRealizationPeriods,
  getAvailableAccountTypes,
  getAvailableBudgetGroups,
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
          disabled={!activeEntity || loading}
          className={`${styles.refreshButton} ${
            activeEntity && !loading ? styles.active : styles.disabled
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

      {/* Filters */}
      {activeEntity && (
        <div className={styles.filterSection}>
          <div className={styles.filterHeader}>
            <h3>Filter Laporan</h3>
          </div>

          <div className={styles.filterGrid}>
            {/* Periode */}
            <div>
              <label className={styles.filterLabel}>Periode</label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                disabled={loading}
                className={styles.filterSelect}
              >
                <option value="all">Semua Periode</option>
                {availablePeriods.map((period) => (
                  <option key={period} value={period}>{period}</option>
                ))}
              </select>
            </div>

            {/* Nama Budget */}
            <div>
              <label className={styles.filterLabel}>Nama Budget</label>
              <select
                value={selectedBudgetGroup}
                onChange={(e) => setSelectedBudgetGroup(e.target.value)}
                disabled={loading}
                className={styles.filterSelect}
              >
                <option value="all">Semua Budget</option>
                {availableBudgetGroups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>

            {/* Tipe Akun */}
            <div>
              <label className={styles.filterLabel}>Tipe Akun</label>
              <select
                value={selectedAccountType}
                onChange={(e) => setSelectedAccountType(e.target.value)}
                disabled={loading}
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
                disabled={loading}
                className={styles.filterInput}
              />
            </div>
          </div>

          <div className={styles.filterInfo}>
            Menampilkan <strong>{filteredGroupedData.length}</strong> dari {groupedData.length} budget group
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {activeEntity && summary && (
        <div className={styles.summaryCards}>
          {/* Total Budget */}
          <div className={`${styles.summaryCard} ${styles.blue}`}>
            <div className={styles.summaryCardLabel}>Total Budget</div>
            <div 
              className={styles.summaryCardValue}
              style={{ fontSize: `${getAdaptiveFontSize(summary.total_budget)}px` }}
            >
              Rp{formatCurrency(summary.total_budget)}
            </div>
          </div>

          {/* Total Realisasi */}
          <div className={`${styles.summaryCard} ${styles.green}`}>
            <div className={styles.summaryCardLabel}>Total Realisasi</div>
            <div 
              className={styles.summaryCardValue}
              style={{ fontSize: `${getAdaptiveFontSize(summary.total_realisasi)}px` }}
            >
              Rp{formatCurrency(summary.total_realisasi)}
            </div>
          </div>

          {/* Variance */}
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

          {/* Variance % */}
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

      {/* Grouped Data Table */}
      {activeEntity && (
        <div className={styles.dataTableContainer}>
          {loading && groupedData.length === 0 ? (
            <div className={styles.loadingState}>⏳ Memuat data...</div>
          ) : filteredGroupedData.length === 0 ? (
            <div className={styles.emptyState}>
              {searchQuery ? (
                <>🔍 Tidak ada data yang cocok dengan pencarian "<strong>{searchQuery}</strong>"</>
              ) : (
                <>📋 Belum ada data realisasi. Pastikan sudah ada budget dan akun accurate tersedia.</>
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
                  className={styles.modalCloseButton}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className={styles.modalBody}>
              {/* Summary Cards for this group */}
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

              {/* Detail Table */}
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

            {/* Modal Footer */}
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