import React, { useEffect, useState } from 'react';
import {
  getBudgetRealizationsLive,
  type BudgetRealization,
  type BudgetRealizationSummary,
} from '../../lib/accurate';
import styles from './PublicRealisasiViewer.module.css';

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

interface Props {
  entityId: string;
  entityName: string;
  onClose: () => void;
  onCloseAll: () => void;
}

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('id-ID');
};

const getAdaptiveFontSize = (amount: number): number => {
  if (amount >= 1_000_000_000_000) return 14;
  if (amount >= 1_000_000_000) return 15;
  return 16;
};

export const PublicRealisasiViewer: React.FC<Props> = ({
  entityId,
  entityName,
  onClose,
  onCloseAll,
}) => {
  const [_realizations, setRealizations] = useState<BudgetRealization[]>([]);
  const [groupedData, setGroupedData] = useState<GroupedBudgetRealization[]>([]);
  const [summary, setSummary] = useState<BudgetRealizationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedGroup, setSelectedGroup] = useState<GroupedBudgetRealization | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [entityId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: realizationsData, error: realizationsError } = 
        await getBudgetRealizationsLive(entityId);

      if (realizationsError) throw realizationsError;

      setRealizations(realizationsData || []);
      const grouped = groupRealizationsByBudgetGroup(realizationsData || []);
      setGroupedData(grouped);
      const summaryData = calculateSummary(realizationsData || [], entityName);
      setSummary(summaryData);
    } catch (err: any) {
      setError('Gagal memuat data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const groupRealizationsByBudgetGroup = (
    data: BudgetRealization[]
  ): GroupedBudgetRealization[] => {
    const groupMap = new Map<string, BudgetRealization[]>();

    data.forEach((item) => {
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

  const calculateSummary = (
    data: BudgetRealization[],
    name: string
  ): BudgetRealizationSummary | null => {
    if (!data || data.length === 0) return null;

    const totalBudget = data.reduce((sum, item) => sum + item.budget_allocated, 0);
    const totalRealisasi = data.reduce((sum, item) => sum + item.realisasi, 0);
    const totalVariance = totalBudget - totalRealisasi;
    const variancePercentage = totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0;
    const overallStatus = totalRealisasi <= totalBudget ? 'ON_TRACK' : 'OVER_BUDGET';

    return {
      entity_id: entityId,
      entity_name: name,
      period: 'all',
      total_accounts: data.length,
      total_budgets: [...new Set(data.map((item) => item.budget_id))].length,
      total_budget: totalBudget,
      total_realisasi: totalRealisasi,
      total_variance: totalVariance,
      variance_percentage: variancePercentage,
      overall_status: overallStatus,
      on_track_count: data.filter((item) => item.status === 'ON_TRACK').length,
      over_budget_count: data.filter((item) => item.status === 'OVER_BUDGET').length,
      last_updated: new Date().toISOString(),
    };
  };

  const handleOpenDetail = (group: GroupedBudgetRealization) => {
    setSelectedGroup(group);
    setShowDetailModal(true);
  };

  const handleCloseDetail = () => {
    setShowDetailModal(false);
    setSelectedGroup(null);
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <div>
            <h2>Realisasi - {entityName}</h2>
            <p>Data publik dari entitas ini</p>
          </div>
          <div className={styles.modalHeaderActions}>
            <button onClick={onClose} className={styles.backButton}>
              ← Kembali
            </button>
            <button onClick={onCloseAll} className={styles.closeButton}>
              ✕
            </button>
          </div>
        </div>

        <div className={styles.modalBody}>
          {loading && <div className={styles.loading}>Memuat data...</div>}
          {error && <div className={styles.error}>{error}</div>}

          {/* Summary Cards */}
          {summary && (
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

              <div
                className={`${styles.summaryCard} ${
                  summary.overall_status === 'OVER_BUDGET' ? styles.red : styles.cyan
                }`}
              >
                <div className={styles.summaryCardLabel}>Variance</div>
                <div
                  className={styles.summaryCardValue}
                  style={{
                    fontSize: `${getAdaptiveFontSize(Math.abs(summary.total_variance))}px`,
                  }}
                >
                  Rp{formatCurrency(Math.abs(summary.total_variance))}
                </div>
                <div className={styles.summaryCardNote}>
                  {summary.overall_status === 'OVER_BUDGET' ? 'Over Budget' : 'Under Budget'}
                </div>
              </div>

              <div
                className={`${styles.summaryCard} ${
                  summary.overall_status === 'OVER_BUDGET' ? styles.red : styles.green
                }`}
              >
                <div className={styles.summaryCardLabel}>Variance %</div>
                <div className={styles.summaryCardValue} style={{ fontSize: '24px' }}>
                  {Math.abs(summary.variance_percentage).toFixed(2)}%
                </div>
                <div className={styles.summaryCardNote}>Sisa Budget</div>
              </div>
            </div>
          )}

          {/* Grouped Data Table */}
          {!loading && groupedData.length > 0 && (
            <div className={styles.tableWrapper}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Periode</th>
                    <th>Budget Group</th>
                    <th>Total Budget</th>
                    <th>Total Realisasi</th>
                    <th>Variance</th>
                    <th>Variance %</th>
                    <th className={styles.center}>Status</th>
                    <th className={styles.center}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedData.map((group, index) => (
                    <tr key={`${group.budget_group_name}-${group.period}-${index}`}>
                      <td>
                        <code className={styles.periodBadge}>{group.period}</code>
                      </td>
                      <td>
                        <div className={styles.budgetGroupName}>{group.budget_group_name}</div>
                        <div className={styles.budgetGroupMeta}>{group.accounts.length} akun</div>
                      </td>
                      <td>
                        <strong
                          style={{
                            fontSize: `${getAdaptiveFontSize(group.total_budget)}px`,
                          }}
                        >
                          Rp{formatCurrency(group.total_budget)}
                        </strong>
                      </td>
                      <td>
                        <strong
                          style={{
                            fontSize: `${getAdaptiveFontSize(group.total_realisasi)}px`,
                            color: '#28a745',
                          }}
                        >
                          Rp{formatCurrency(group.total_realisasi)}
                        </strong>
                      </td>
                      <td>
                        <strong
                          style={{
                            fontSize: `${getAdaptiveFontSize(Math.abs(group.total_variance))}px`,
                            color: group.total_variance >= 0 ? '#28a745' : '#dc3545',
                          }}
                        >
                          Rp{formatCurrency(Math.abs(group.total_variance))}
                        </strong>
                      </td>
                      <td>
                        <strong
                          style={{
                            fontSize: '14px',
                            color: group.total_variance >= 0 ? '#28a745' : '#dc3545',
                          }}
                        >
                          {Math.abs(group.variance_percentage).toFixed(2)}%
                        </strong>
                      </td>
                      <td className={styles.center}>
                        <span
                          className={`${styles.statusBadge} ${
                            group.status === 'ON_TRACK' ? styles.onTrack : styles.overBudget
                          }`}
                        >
                          {group.status === 'ON_TRACK' ? 'On Track' : 'Over Budget'}
                        </span>
                      </td>
                      <td className={styles.center}>
                        <button
                          onClick={() => handleOpenDetail(group)}
                          className={styles.detailButton}
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && groupedData.length === 0 && (
            <div className={styles.empty}>Tidak ada data realisasi untuk entitas ini</div>
          )}
        </div>

        {/* Detail Modal */}
        {showDetailModal && selectedGroup && (
          <div className={styles.detailModalOverlay} onClick={handleCloseDetail}>
            <div className={styles.detailModalContainer} onClick={(e) => e.stopPropagation()}>
              <div className={styles.detailModalHeader}>
                <div className={styles.detailModalHeaderContent}>
                  <h3>Detail Akun - {selectedGroup.budget_group_name}</h3>
                  <p>
                    Periode: {selectedGroup.period} • {selectedGroup.accounts.length} akun
                  </p>
                </div>

                <button onClick={handleCloseDetail} className={styles.detailModalCloseButton}>
                  ✕
                </button>
              </div>

              <div className={styles.detailModalBody}>
                {/* Summary Cards di Detail Modal */}
                <div className={styles.detailModalSummaryCards}>
                  <div className={`${styles.detailModalSummaryCard} ${styles.blue}`}>
                    <div className={styles.detailModalSummaryCardLabel}>TOTAL BUDGET</div>
                    <div className={styles.detailModalSummaryCardValue}>
                      Rp{formatCurrency(selectedGroup.total_budget)}
                    </div>
                  </div>
                  <div className={`${styles.detailModalSummaryCard} ${styles.green}`}>
                    <div className={styles.detailModalSummaryCardLabel}>TOTAL REALISASI</div>
                    <div className={styles.detailModalSummaryCardValue}>
                      Rp{formatCurrency(selectedGroup.total_realisasi)}
                    </div>
                  </div>
                  <div
                    className={`${styles.detailModalSummaryCard} ${
                      selectedGroup.status === 'OVER_BUDGET' ? styles.red : styles.cyan
                    }`}
                  >
                    <div className={styles.detailModalSummaryCardLabel}>VARIANCE</div>
                    <div className={styles.detailModalSummaryCardValue}>
                      Rp{formatCurrency(Math.abs(selectedGroup.total_variance))}
                    </div>
                  </div>
                  <div
                    className={`${styles.detailModalSummaryCard} ${
                      selectedGroup.status === 'OVER_BUDGET' ? styles.red : styles.green
                    }`}
                  >
                    <div className={styles.detailModalSummaryCardLabel}>VARIANCE %</div>
                    <div className={styles.detailModalSummaryCardValue}>
                      {Math.abs(selectedGroup.variance_percentage).toFixed(2)}%
                    </div>
                    <div className={styles.detailModalSummaryCardNote}>
                      {selectedGroup.status === 'OVER_BUDGET' ? 'Over Budget' : 'Sisa Budget'}
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className={styles.detailModalTableWrapper}>
                  <table className={styles.detailModalTable}>
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
                            <code className={styles.detailAccountCode}>{account.account_code}</code>
                          </td>
                          <td>
                            <div className={styles.detailAccountName}>{account.account_name}</div>
                          </td>
                          <td>
                            <span className={styles.detailAccountTypeBadge}>
                              {account.account_type || '-'}
                            </span>
                          </td>
                          <td>
                            <strong
                              style={{
                                fontSize: `${getAdaptiveFontSize(account.budget_allocated)}px`,
                              }}
                            >
                              Rp{formatCurrency(account.budget_allocated)}
                            </strong>
                          </td>
                          <td>
                            <strong
                              style={{
                                fontSize: `${getAdaptiveFontSize(account.realisasi)}px`,
                                color: '#28a745',
                              }}
                            >
                              Rp{formatCurrency(account.realisasi)}
                            </strong>
                          </td>
                          <td>
                            <strong
                              style={{
                                fontSize: `${getAdaptiveFontSize(Math.abs(account.variance))}px`,
                                color: account.variance >= 0 ? '#28a745' : '#dc3545',
                              }}
                            >
                              Rp{formatCurrency(Math.abs(account.variance))}
                            </strong>
                          </td>
                          <td>
                            <strong
                              style={{
                                fontSize: '14px',
                                color: account.variance >= 0 ? '#28a745' : '#dc3545',
                              }}
                            >
                              {Math.abs(account.variance_percentage).toFixed(2)}%
                            </strong>
                          </td>
                          <td className={styles.center}>
                            <span
                              className={`${styles.detailStatusBadge} ${
                                account.status === 'ON_TRACK'
                                  ? styles.detailOnTrack
                                  : styles.detailOverBudget
                              }`}
                            >
                              {account.status === 'ON_TRACK' ? 'On Track' : 'Over Budget'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className={styles.detailModalFooter}>
                <button onClick={handleCloseDetail} className={styles.detailModalFooterButton}>
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicRealisasiViewer;