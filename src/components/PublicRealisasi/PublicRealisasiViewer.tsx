import React, { useEffect, useState } from 'react';
import {
  getBudgetRealizationsLive,
  type BudgetRealization,
  type BudgetRealizationSummary,
} from '../../lib/accurate';
import { ExportFile } from '../Export&Import/ExportFile';
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
}) => {
  const [realizations, setRealizations] = useState<BudgetRealization[]>([]);
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
          <button onClick={onClose} className={styles.closeButton}>
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {loading && <div className={styles.loading}>⏳ Memuat data...</div>}
          {error && <div className={styles.error}>{error}</div>}

          {/* Summary Cards */}
          {summary && (
            <div className={styles.summaryCards}>
              <div className={`${styles.summaryCard} ${styles.blue}`}>
                <div className={styles.summaryCardLabel}>TOTAL BUDGET</div>
                <div
                  className={styles.summaryCardValue}
                  style={{ fontSize: `${getAdaptiveFontSize(summary.total_budget)}px` }}
                >
                  Rp{formatCurrency(summary.total_budget)}
                </div>
              </div>

              <div className={`${styles.summaryCard} ${styles.green}`}>
                <div className={styles.summaryCardLabel}>TOTAL REALISASI</div>
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
                <div className={styles.summaryCardLabel}>VARIANCE</div>
                <div
                  className={styles.summaryCardValue}
                  style={{
                    fontSize: `${getAdaptiveFontSize(Math.abs(summary.total_variance))}px`,
                  }}
                >
                  Rp{formatCurrency(Math.abs(summary.total_variance))}
                </div>
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
                        <strong>Rp{formatCurrency(group.total_budget)}</strong>
                      </td>
                      <td>
                        <strong style={{ color: '#28a745' }}>
                          Rp{formatCurrency(group.total_realisasi)}
                        </strong>
                      </td>
                      <td>
                        <strong
                          style={{
                            color: group.total_variance >= 0 ? '#28a745' : '#dc3545',
                          }}
                        >
                          Rp{formatCurrency(Math.abs(group.total_variance))}
                        </strong>
                      </td>
                      <td className={styles.center}>
                        <span
                          className={`${styles.statusBadge} ${
                            group.status === 'ON_TRACK' ? styles.onTrack : styles.overBudget
                          }`}
                        >
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

          {!loading && groupedData.length === 0 && (
            <div className={styles.empty}>Tidak ada data realisasi untuk entitas ini</div>
          )}
        </div>

     {/* Detail Modal */}
{showDetailModal && selectedGroup && (
  <div className={styles.detailModalOverlay} onClick={handleCloseDetail}>
    <div className={styles.detailModalContainer} onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className={styles.detailCardHeader}>
        <div>
          <h3 className={styles.detailCardTitle}>
            Detail Akun - {selectedGroup.budget_group_name}
          </h3>
          <p className={styles.detailCardSubtitle}>
            Periode: {selectedGroup.period} • {selectedGroup.accounts.length} akun
          </p>
        </div>
        <button onClick={handleCloseDetail} className={styles.detailCloseBtn}>
          ✕
        </button>
      </div>

      {/* Body */}
      <div className={styles.detailModalContent}>
        {/* Summary Section */}
        <div className={styles.detailSummarySection}>
          <div className={styles.detailSummaryRow}>
            <div className={styles.detailSummaryItem}>
              <span className={styles.detailSummaryLabel}>TOTAL BUDGET</span>
              <span className={styles.detailSummaryValue} style={{ color: '#0066cc' }}>
                Rp{formatCurrency(selectedGroup.total_budget)}
              </span>
            </div>
            <div className={styles.detailSummaryItem}>
              <span className={styles.detailSummaryLabel}>TOTAL REALISASI</span>
              <span className={styles.detailSummaryValue} style={{ color: '#28a745' }}>
                Rp{formatCurrency(selectedGroup.total_realisasi)}
              </span>
            </div>
          </div>

          <div className={styles.detailSummaryRow}>
            <div className={styles.detailSummaryItem}>
              <span className={styles.detailSummaryLabel}>VARIANCE</span>
              <span 
                className={styles.detailSummaryValue}
                style={{ color: selectedGroup.total_variance >= 0 ? '#28a745' : '#dc3545' }}
              >
                Rp{formatCurrency(Math.abs(selectedGroup.total_variance))}
              </span>
            </div>
            <div className={styles.detailSummaryItem}>
              <span className={styles.detailSummaryLabel}>VARIANCE %</span>
              <span 
                className={styles.detailSummaryValue}
                style={{ color: selectedGroup.total_variance >= 0 ? '#28a745' : '#dc3545' }}
              >
                {Math.abs(selectedGroup.variance_percentage).toFixed(2)}%
              </span>
            </div>
          </div>

          <div className={styles.detailSummaryRow}>
            <div className={styles.detailSummaryItem}>
              <span className={styles.detailSummaryLabel}>
                {selectedGroup.status === 'OVER_BUDGET' ? 'Over Budget' : 'On Track'}
              </span>
            </div>
            <div className={styles.detailSummaryItem}>
              <span className={styles.detailSummaryLabel}>{selectedGroup.accounts.length}</span>
              <span className={styles.detailSummarySubtext}>Akun</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <h4 className={styles.detailTableTitle}>
          Rincian Per Akun ({selectedGroup.accounts.length})
        </h4>

        {/* Table */}
        <div className={styles.detailTableContainer}>
          <table className={styles.detailTable}>
            <thead>
              <tr>
                <th>Kode Akun</th>
                <th>Nama Akun</th>
                <th>Tipe</th>
                <th>Budget</th>
                <th>Realisasi</th>
                <th>Variance</th>
                <th className={styles.detailTextCenter}>Status</th>
              </tr>
            </thead>
            <tbody>
              {selectedGroup.accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.account_code}</td>
                  <td>{account.account_name}</td>
                  <td>
                    <span className={styles.detailTypeBadge}>
                      {account.account_type || '-'}
                    </span>
                  </td>
                  <td style={{ color: '#0066cc' }}>
                    Rp{formatCurrency(account.budget_allocated)}
                  </td>
                  <td style={{ color: '#28a745' }}>
                    Rp{formatCurrency(account.realisasi)}
                  </td>
                  <td style={{ color: account.variance >= 0 ? '#28a745' : '#dc3545' }}>
                    Rp{formatCurrency(Math.abs(account.variance))}
                  </td>
                  <td className={styles.detailTextCenter}>
                    <span
                      className={`${styles.detailStatusIcon} ${
                        account.status === 'ON_TRACK'
                          ? styles.detailStatusOnTrack
                          : styles.detailStatusOver
                      }`}
                    >
                      {account.status === 'ON_TRACK' ? '⚠' : '⚠'}
                    </span>
                    {account.status === 'ON_TRACK' ? ' Over Budget' : ' Over Budget'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.detailModalFooter}>
        <button onClick={handleCloseDetail} className={styles.detailCancelButton}>
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

export default PublicRealisasiViewer