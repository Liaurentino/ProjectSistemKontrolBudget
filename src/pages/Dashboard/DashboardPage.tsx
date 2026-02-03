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
import { getEntities } from '../../lib/supabase';
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

type ViewMode = 'single' | 'all';

const DashboardPage: React.FC = () => {
  const { activeEntity, entities: contextEntities } = useEntity();

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [userEntities, setUserEntities] = useState<any[]>([]);

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

  // Load user entities on mount
  useEffect(() => {
    loadUserEntities();
  }, []);

  // Load data when mode or selection changes
  useEffect(() => {
    if (viewMode === 'single' && selectedEntityId) {
      loadSingleEntityData(selectedEntityId);
    } else if (viewMode === 'all' && selectedPeriod) {
      loadAllEntitiesDataByPeriod(selectedPeriod);
    }
  }, [viewMode, selectedEntityId, selectedPeriod]);

  const loadUserEntities = async () => {
    try {
      const { data, error } = await getEntities();
      if (error) throw error;
      
      setUserEntities(data || []);
      
      // Set default: first entity for single mode
      if (data && data.length > 0) {
        setSelectedEntityId(data[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load entities:', err);
    }
  };

  const loadSingleEntityData = async (entityId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: realizationsData, error: realizationsError } = 
        await getBudgetRealizationsLive(entityId);

      if (realizationsError) throw realizationsError;

      setRealizations(realizationsData || []);

      const { data: accountsData, error: accountsError } = 
        await getLocalAccounts(entityId);

      if (accountsError) throw accountsError;
      setTotalAccounts(accountsData?.length || 0);

      if (realizationsData && realizationsData.length > 0) {
        processChartData(realizationsData);
        processOverBudgetItems(realizationsData);
        calculateBetterStatistics(realizationsData);
      } else {
        resetData();
      }
    } catch (err: any) {
      console.error('[DashboardPage] Error:', err);
      setError('Gagal memuat data: ' + err.message);
      resetData();
    } finally {
      setLoading(false);
    }
  };

  const loadAllEntitiesDataByPeriod = async (period: string) => {
    setLoading(true);
    setError(null);

    try {
      // Load data from all user entities
      const allRealizationsPromises = userEntities.map(entity => 
        getBudgetRealizationsLive(entity.id)
      );

      const allResults = await Promise.all(allRealizationsPromises);
      
      // Combine all realizations and filter by selected period
      const combinedRealizations: BudgetRealization[] = [];
      
      allResults.forEach((result, index) => {
        if (result.data) {
          const filteredData = result.data.filter(item => item.period === period);
          combinedRealizations.push(...filteredData);
        }
      });

      setRealizations(combinedRealizations);

      // Count total accounts from all entities
      let totalAccs = 0;
      for (const entity of userEntities) {
        const { data: accountsData } = await getLocalAccounts(entity.id);
        totalAccs += accountsData?.length || 0;
      }
      setTotalAccounts(totalAccs);

      if (combinedRealizations.length > 0) {
        processChartDataForAllEntities(combinedRealizations);
        processOverBudgetItems(combinedRealizations);
        calculateBetterStatistics(combinedRealizations);
      } else {
        resetData();
      }
    } catch (err: any) {
      console.error('[DashboardPage] Error:', err);
      setError('Gagal memuat data: ' + err.message);
      resetData();
    } finally {
      setLoading(false);
    }
  };

  // Load available periods when switching to "all" mode
  useEffect(() => {
    if (viewMode === 'all' && userEntities.length > 0) {
      loadAvailablePeriods();
    }
  }, [viewMode, userEntities]);

  const loadAvailablePeriods = async () => {
    try {
      const periodsSet = new Set<string>();
      
      for (const entity of userEntities) {
        const { data } = await getBudgetRealizationsLive(entity.id);
        if (data) {
          data.forEach(item => periodsSet.add(item.period));
        }
      }
      
      const periods = Array.from(periodsSet).sort();
      setAvailablePeriods(periods);
      
      // Set default period (latest)
      if (periods.length > 0 && !selectedPeriod) {
        setSelectedPeriod(periods[periods.length - 1]);
      }
    } catch (err) {
      console.error('Failed to load periods:', err);
    }
  };

  const resetData = () => {
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

  const processChartDataForAllEntities = (data: BudgetRealization[]) => {
    // Group by entity
    const entityMap = new Map<string, { budget: number; realisasi: number }>();

    data.forEach(item => {
      const entity = userEntities.find(e => e.id === item.entity_id);
      const entityName = entity?.entity_name || 'Unknown';
      
      const existing = entityMap.get(entityName) || { budget: 0, realisasi: 0 };
      entityMap.set(entityName, {
        budget: existing.budget + item.budget_allocated,
        realisasi: existing.realisasi + item.realisasi,
      });
    });

    const chartPoints: ChartDataPoint[] = Array.from(entityMap.entries())
      .map(([entityName, values]) => ({
        period: entityName, // Using "period" field for entity name in chart
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

  const getChartTitle = () => {
    if (viewMode === 'single') {
      const entity = userEntities.find(e => e.id === selectedEntityId);
      return `Budget vs Realisasi - ${entity?.entity_name || 'Unknown'}`;
    }
    return `Budget vs Realisasi - Semua Entitas (${selectedPeriod})`;
  };

  const getChartXAxisLabel = () => {
    return viewMode === 'single' ? 'Periode' : 'Entitas';
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.headerTitle}>Dashboard</h1>
          <p className={styles.headerSubtitle}>
            Ringkasan Budget vs Realisasi
          </p>
        </div>
      </div>

      {/* No Entities Warning */}
      {userEntities.length === 0 && (
        <div className={styles.noEntityWarning}>
          <h3 className={styles.noEntityWarningTitle}>Belum Ada Entitas</h3>
          <p className={styles.noEntityWarningText}>
            Silakan buat entitas terlebih dahulu di halaman Manajemen Entitas
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
      {userEntities.length > 0 && (
        <>
          {/* Mode Tabs */}
          <div className={styles.modeTabs}>
            <button
              onClick={() => setViewMode('single')}
              className={`${styles.modeTab} ${viewMode === 'single' ? styles.modeTabActive : ''}`}
            >
              Single Entity
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`${styles.modeTab} ${viewMode === 'all' ? styles.modeTabActive : ''}`}
            >
              All Entities by Period
            </button>
          </div>

          {/* Filters */}
          <div className={styles.filtersCard}>
            {viewMode === 'single' ? (
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Pilih Entitas:</label>
                <select
                  value={selectedEntityId}
                  onChange={(e) => setSelectedEntityId(e.target.value)}
                  className={styles.filterSelect}
                >
                  {userEntities.map(entity => (
                    <option key={entity.id} value={entity.id}>
                      {entity.entity_name}
                    </option>
                  ))}
                </select>
                <span className={styles.filterHint}>
                  Menampilkan semua periode dari entitas yang dipilih
                </span>
              </div>
            ) : (
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Pilih Periode:</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className={styles.filterSelect}
                  disabled={availablePeriods.length === 0}
                >
                  {availablePeriods.length === 0 ? (
                    <option>Loading...</option>
                  ) : (
                    availablePeriods.map(period => (
                      <option key={period} value={period}>
                        {period}
                      </option>
                    ))
                  )}
                </select>
                <span className={styles.filterHint}>
                  Menampilkan semua entitas pada periode yang dipilih
                </span>
              </div>
            )}
          </div>

          {/* RECHARTS Section */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>
              {getChartTitle()}
            </h3>

            {loading ? (
              <div className={styles.chartLoading}>
                Memuat data...
              </div>
            ) : chartData.length === 0 ? (
              <div className={styles.chartEmpty}>
                Belum ada data budget untuk {viewMode === 'single' ? 'entitas' : 'periode'} yang dipilih
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
                    label={{ value: getChartXAxisLabel(), position: 'insideBottom', offset: -10 }}
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
                Peringatan Over Budget
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
                Insight & Statistik
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
                      {realizations.length} budget items dari {viewMode === 'single' ? '1 entitas' : `${userEntities.length} entitas`}
                    </div>
                  </div>

                  {/* Unutilized & Over Budget Amounts */}
                  <div className={styles.amountsGrid}>
                    <div className={styles.amountBoxUnutilized}>
                      <div className={styles.amountLabel}>
                        Unutilized Budget
                      </div>
                      <div className={styles.amountValue}>
                        Rp{formatCurrency(stats.totalUnutilized)}
                      </div>
                      <div className={styles.amountSubtext}>
                        belum terpakai
                      </div>
                    </div>

                    <div className={styles.amountBoxOver}>
                      <div className={styles.amountLabel}>
                        Total Over Budget
                      </div>
                      <div className={styles.amountValue}>
                        Rp{formatCurrency(stats.totalOverBudget)}
                      </div>
                      <div className={styles.amountSubtext}>
                        melebihi budget
                      </div>
                    </div>
                  </div>

                  {/* Distribution Cards */}
                  <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>
                        Total Akun COA
                      </div>
                      <div className={styles.statValue}>
                        {totalAccounts}
                      </div>
                    </div>

                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>
                        On Track
                      </div>
                      <div className={`${styles.statValue} ${styles.statValueSuccess}`}>
                        {stats.onTrackCount}
                      </div>
                    </div>

                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>
                        Over Budget
                      </div>
                      <div className={`${styles.statValue} ${styles.statValueDanger}`}>
                        {stats.overBudgetCount}
                      </div>
                    </div>

                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>
                        Under-utilized
                      </div>
                      <div className={`${styles.statValue} ${styles.statValueWarning}`}>
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