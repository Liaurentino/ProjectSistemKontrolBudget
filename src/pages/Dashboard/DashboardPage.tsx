import React, { useState, useEffect } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useEntity } from '../../contexts/EntityContext';
import {
  getBudgetRealizationsLive,
  getLocalAccounts,
  type BudgetRealization,
} from '../../lib/accurate';
import styles from './DashboardPage.module.css';

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('id-ID');
};

interface ChartDataPoint {
  period: string;
  budget: number;
  realisasi: number;
}

interface OverBudgetItem {
  account_code: string;
  account_name: string;
  budget_name: string;
  period: string;
  budget: number;
  realisasi: number;
  variance: number;
  variance_percentage: number;
}

const DashboardPage: React.FC = () => {
  const { activeEntity } = useEntity();

  const [realizations, setRealizations] = useState<BudgetRealization[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [overBudgetItems, setOverBudgetItems] = useState<OverBudgetItem[]>([]);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState({
    totalBudget: 0,
    totalRealisasi: 0,
    averageUtilization: 0,
    totalUnutilized: 0,
    totalOverBudget: 0,
    overBudgetCount: 0,
    onTrackCount: 0,
    underUtilizedCount: 0,
  });

  useEffect(() => {
    if (activeEntity?.id) {
      loadDashboardData();
    } else {
      setRealizations([]);
      setChartData([]);
      setOverBudgetItems([]);
      setTotalAccounts(0);
      setStats({
        totalBudget: 0,
        totalRealisasi: 0,
        averageUtilization: 0,
        totalUnutilized: 0,
        totalOverBudget: 0,
        overBudgetCount: 0,
        onTrackCount: 0,
        underUtilizedCount: 0,
      });
    }
  }, [activeEntity?.id]);

  const loadDashboardData = async () => {
    if (!activeEntity) return;

    setLoading(true);
    setError(null);

    try {
      const { data: realizationsData, error: realizationsError } = 
        await getBudgetRealizationsLive(activeEntity.id);

      if (realizationsError) throw realizationsError;

      setRealizations(realizationsData || []);

      const { data: accountsData, error: accountsError } = 
        await getLocalAccounts(activeEntity.id);

      if (accountsError) throw accountsError;
      setTotalAccounts(accountsData?.length || 0);

      if (realizationsData && realizationsData.length > 0) {
        processChartData(realizationsData);
        processOverBudgetItems(realizationsData);
        calculateBetterStatistics(realizationsData);
      } else {
        setChartData([]);
        setOverBudgetItems([]);
        setStats({
          totalBudget: 0,
          totalRealisasi: 0,
          averageUtilization: 0,
          totalUnutilized: 0,
          totalOverBudget: 0,
          overBudgetCount: 0,
          onTrackCount: 0,
          underUtilizedCount: 0,
        });
      }

      console.log('[DashboardPage] Loaded data successfully');
    } catch (err: any) {
      console.error('[DashboardPage] Error:', err);
      setError('Gagal memuat data dashboard: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (data: BudgetRealization[]) => {
    const periodMap = new Map<string, { budget: number; realisasi: number }>();

    data.forEach(item => {
      const existing = periodMap.get(item.period) || { budget: 0, realisasi: 0 };
      periodMap.set(item.period, {
        budget: existing.budget + item.budget_allocated,
        realisasi: existing.realisasi + item.realisasi,
      });
    });

    const chartPoints: ChartDataPoint[] = Array.from(periodMap.entries())
      .map(([period, values]) => ({
        period,
        budget: values.budget,
        realisasi: values.realisasi,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    setChartData(chartPoints);
  };

  const processOverBudgetItems = (data: BudgetRealization[]) => {
    const overBudget = data
      .filter(item => item.status === 'OVER_BUDGET')
      .map(item => ({
        account_code: item.account_code,
        account_name: item.account_name,
        budget_name: item.budgets?.name || 'Unknown',
        period: item.period,
        budget: item.budget_allocated,
        realisasi: item.realisasi,
        variance: item.variance,
        variance_percentage: item.variance_percentage,
      }))
      .sort((a, b) => a.variance - b.variance)
      .slice(0, 5);

    setOverBudgetItems(overBudget);
  };

  const calculateBetterStatistics = (data: BudgetRealization[]) => {
    const totalBudget = data.reduce((sum, item) => sum + item.budget_allocated, 0);
    const totalRealisasi = data.reduce((sum, item) => sum + item.realisasi, 0);
    
    const utilizationRates = data.map(item => {
      if (item.budget_allocated === 0) return 0;
      return (item.realisasi / item.budget_allocated) * 100;
    });
    
    const averageUtilization = utilizationRates.length > 0
      ? utilizationRates.reduce((sum, rate) => sum + rate, 0) / utilizationRates.length
      : 0;
    
    const totalUnutilized = data.reduce((sum, item) => {
      const unutilized = item.budget_allocated - item.realisasi;
      return sum + (unutilized > 0 ? unutilized : 0);
    }, 0);
    
    const totalOverBudget = data.reduce((sum, item) => {
      const over = item.realisasi - item.budget_allocated;
      return sum + (over > 0 ? over : 0);
    }, 0);
    
    const overBudgetCount = data.filter(item => item.status === 'OVER_BUDGET').length;
    const onTrackCount = data.filter(item => item.status === 'ON_TRACK').length;
    const underUtilizedCount = data.filter(item => {
      const utilization = item.budget_allocated > 0 
        ? (item.realisasi / item.budget_allocated) * 100 
        : 0;
      return utilization < 80 && item.status !== 'OVER_BUDGET';
    }).length;

    setStats({
      totalBudget,
      totalRealisasi,
      averageUtilization,
      totalUnutilized,
      totalOverBudget,
      overBudgetCount,
      onTrackCount,
      underUtilizedCount,
    });
  };

  // Custom Tooltip for Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={styles.customTooltip}>
          <p className={styles.tooltipPeriod}>
            {payload[0].payload.period}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className={styles.tooltipItem} style={{ color: entry.color }}>
              <strong>{entry.name}:</strong> Rp{formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Format Y-axis
  const formatYAxis = (value: number) => {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}M`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}jt`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}rb`;
    return value.toString();
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.headerTitle}>📊 Dashboard</h2>
        <p className={styles.headerSubtitle}>
          Ringkasan Budget vs Realisasi
        </p>
        {activeEntity && (
          <p className={styles.headerEntity}>
            Entitas: <strong>{activeEntity.entity_name || activeEntity.name}</strong>
          </p>
        )}
      </div>

      {/* No Entity Warning */}
      {!activeEntity && (
        <div className={styles.noEntityWarning}>
          <h3 className={styles.noEntityWarningTitle}>Belum Ada Entitas Aktif</h3>
          <p className={styles.noEntityWarningText}>
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

      {/* Main Content */}
      {activeEntity && (
        <>
          {/* RECHARTS Section */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>
              Budget vs Realisasi
            </h3>

            {loading ? (
              <div className={styles.chartLoading}>
                ⏳ Memuat data...
              </div>
            ) : chartData.length === 0 ? (
              <div className={styles.chartEmpty}>
                📋 Belum ada data budget. Silakan buat budget terlebih dahulu.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 12, fontWeight: 500 }}
                    stroke="#495057"
                  />
                  <YAxis 
                    tickFormatter={formatYAxis}
                    tick={{ fontSize: 11 }}
                    stroke="#495057"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="circle"
                  />
                  <Bar 
                    dataKey="budget" 
                    fill="#007bff" 
                    name="Budget"
                    radius={[4, 4, 0, 0]}
                    opacity={0.8}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="realisasi" 
                    stroke="#28a745" 
                    strokeWidth={3}
                    name="Realisasi"
                    dot={{ fill: '#28a745', strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Bottom Section */}
          <div className={styles.bottomGrid}>
            {/* Over Budget Warnings */}
            <div className={styles.overBudgetCard}>
              <h3 className={styles.overBudgetTitle}>
                ⚠️ Peringatan Over Budget
              </h3>

              {loading ? (
                <div className={styles.overBudgetLoading}>
                  Memuat...
                </div>
              ) : overBudgetItems.length === 0 ? (
                <div className={styles.overBudgetEmpty}>
                  <div className={styles.overBudgetEmptyIcon}>✓</div>
                  <div className={styles.overBudgetEmptyTitle}>Semua Budget On Track!</div>
                  <div className={styles.overBudgetEmptyText}>
                    Tidak ada akun yang melebihi budget
                  </div>
                </div>
              ) : (
                <div className={styles.overBudgetList}>
                  {overBudgetItems.map((item, index) => (
                    <div key={index} className={styles.overBudgetItem}>
                      <div className={styles.overBudgetItemHeader}>
                        <span className={styles.overBudgetItemCode}>
                          {item.account_code}
                        </span>
                        <span className={styles.overBudgetItemPeriod}>
                          {item.period}
                        </span>
                      </div>
                      <div className={styles.overBudgetItemName}>
                        {item.account_name}
                      </div>
                      <div className={styles.overBudgetItemAmounts}>
                        <div>
                          <div className={styles.overBudgetItemLabel}>Budget:</div>
                          <div className={styles.overBudgetItemBudget}>
                            Rp{formatCurrency(item.budget)}
                          </div>
                        </div>
                        <div>
                          <div className={styles.overBudgetItemLabel}>Realisasi:</div>
                          <div className={styles.overBudgetItemRealisasi}>
                            Rp{formatCurrency(item.realisasi)}
                          </div>
                        </div>
                      </div>
                      <div className={styles.overBudgetItemVariance}>
                        Over: Rp{formatCurrency(Math.abs(item.variance))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Insights & Statistics */}
            <div className={styles.insightsCard}>
              <h3 className={styles.insightsTitle}>
                📈 Insight & Statistik
              </h3>

              {loading ? (
                <div className={styles.insightsLoading}>
                  Memuat...
                </div>
              ) : (
                <div className={styles.insightsContent}>
                  {/* Average Utilization */}
                  <div>
                    <div className={styles.utilizationHeader}>
                      <span className={styles.utilizationLabel}>
                        Rata-rata Utilisasi per Item
                      </span>
                      <span className={`${styles.utilizationPercentage} ${
                        stats.averageUtilization > 100 
                          ? styles.utilizationPercentageOver 
                          : styles.utilizationPercentageNormal
                      }`}>
                        {stats.averageUtilization.toFixed(1)}%
                      </span>
                    </div>
                    <div className={styles.utilizationBarContainer}>
                      <div 
                        className={`${styles.utilizationBar} ${
                          stats.averageUtilization > 100 
                            ? styles.utilizationBarOver 
                            : stats.averageUtilization > 80 
                            ? styles.utilizationBarWarning 
                            : styles.utilizationBarNormal
                        }`}
                        style={{ width: `${Math.min(stats.averageUtilization, 100)}%` }}
                      />
                    </div>
                    <div className={styles.utilizationHint}>
                      💡 Rata-rata dari {realizations.length} budget items
                    </div>
                  </div>

                  {/* Unutilized & Over Budget Amounts */}
                  <div className={styles.amountsGrid}>
                    <div className={styles.amountBoxUnutilized}>
                      <div className={`${styles.amountLabel} ${styles.amountLabelUnutilized}`}>
                        Unutilized Budget
                      </div>
                      <div className={`${styles.amountValue} ${styles.amountValueUnutilized}`}>
                        Rp{formatCurrency(stats.totalUnutilized)}
                      </div>
                      <div className={`${styles.amountSubtext} ${styles.amountSubtextUnutilized}`}>
                        belum terpakai
                      </div>
                    </div>

                    <div className={styles.amountBoxOver}>
                      <div className={`${styles.amountLabel} ${styles.amountLabelOver}`}>
                        Total Over Budget
                      </div>
                      <div className={`${styles.amountValue} ${styles.amountValueOver}`}>
                        Rp{formatCurrency(stats.totalOverBudget)}
                      </div>
                      <div className={`${styles.amountSubtext} ${styles.amountSubtextOver}`}>
                        melebihi budget
                      </div>
                    </div>
                  </div>

                  {/* Distribution Cards */}
                  <div className={styles.statsGrid}>
                    <div className={styles.statCardTotal}>
                      <div className={`${styles.statLabel} ${styles.statLabelTotal}`}>
                        Total Akun COA
                      </div>
                      <div className={`${styles.statValue} ${styles.statValueTotal}`}>
                        {totalAccounts}
                      </div>
                    </div>

                    <div className={styles.statCardOnTrack}>
                      <div className={`${styles.statLabel} ${styles.statLabelOnTrack}`}>
                        On Track
                      </div>
                      <div className={`${styles.statValue} ${styles.statValueOnTrack}`}>
                        {stats.onTrackCount}
                      </div>
                    </div>

                    <div className={styles.statCardOver}>
                      <div className={`${styles.statLabel} ${styles.statLabelOver}`}>
                        Over Budget
                      </div>
                      <div className={`${styles.statValue} ${styles.statValueOver}`}>
                        {stats.overBudgetCount}
                      </div>
                    </div>

                    <div className={styles.statCardUnder}>
                      <div className={`${styles.statLabel} ${styles.statLabelUnder}`}>
                        Under-utilized
                      </div>
                      <div className={`${styles.statValue} ${styles.statValueUnder}`}>
                        {stats.underUtilizedCount}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;