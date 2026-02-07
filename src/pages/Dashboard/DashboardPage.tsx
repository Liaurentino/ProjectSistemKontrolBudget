import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
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
      const allRealizationsPromises = userEntities.map(entity => 
        getBudgetRealizationsLive(entity.id)
      );

      const allResults = await Promise.all(allRealizationsPromises);
      
      const combinedRealizations: BudgetRealization[] = [];
      
      allResults.forEach((result) => {
        if (result.data) {
          const filteredData = result.data.filter(item => item.period === period);
          combinedRealizations.push(...filteredData);
        }
      });

      setRealizations(combinedRealizations);

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
        period: entityName,
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
    {/* COMPACT FILTERS & TABS - COMBINED IN ONE CARD */}
    <div className={styles.filtersCard}>
      {/* Mode Tabs - Compact */}
      <div className={styles.modeTabsCompact}>
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
          All Entities
        </button>
      </div>

      {/* Filter Dropdown */}
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
        </div>
      )}

      {/* Hint Text */}
      <span className={styles.filterHint}>
        {viewMode === 'single' 
          ? 'Menampilkan semua periode dari entitas yang dipilih'
          : 'Menampilkan semua entitas pada periode yang dipilih'
        }
      </span>
    </div>


          {/* NEW LAYOUT GRID */}
          <div className={styles.mainGrid}>
            {/* LEFT COLUMN (Chart + Over Budget) */}
            <div className={styles.leftColumn}>
              {/* CHART CARD */}
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
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                      data={chartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                      <XAxis 
                        dataKey="period" 
                        tick={{ fontSize: 11, fontWeight: 500 }}
                        stroke="#495057"
                      />
                      <YAxis 
                        tickFormatter={formatYAxis}
                        tick={{ fontSize: 10 }}
                        stroke="#495057"
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend 
                        wrapperStyle={{ paddingTop: '15px' }}
                        iconType="square"
                      />
                      <Bar 
                        dataKey="budget" 
                        fill="#93C5FD" 
                        name="Budget"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar 
                        dataKey="realisasi" 
                        fill="#60A5FA" 
                        name="Realisasi"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* OVER BUDGET TABLE-STYLE */}
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
                    <div className={styles.overBudgetEmptyText}>
                      Semua Budget On Track!
                    </div>
                  </div>
                ) : (
                  <div className={styles.overBudgetTable}>
                    {/* Table Header */}
                    <div className={styles.overBudgetTableHeader}>
                      <div className={styles.headerCell}>Account</div>
                      <div className={styles.headerCell}>Period</div>
                      <div className={styles.headerCell}>Budget</div>
                      <div className={styles.headerCell}>Realisasi</div>
                      <div className={styles.headerCell}>Variance</div>
                    </div>

                    {/* Table Body */}
                    <div className={styles.overBudgetTableBody}>
                      {overBudgetItems.map((item, index) => (
                        <div key={index} className={styles.overBudgetTableRow}>
                          <div className={styles.accountCell}>
                            <div className={styles.accountCode}>{item.account_code}</div>
                            <div className={styles.accountName}>{item.account_name}</div>
                          </div>
                          <div className={styles.periodCell}>
                            {item.period}
                          </div>
                          <div className={styles.budgetCell}>
                            Rp{formatCurrency(item.budget)}
                          </div>
                          <div className={styles.realisasiCell}>
                            Rp{formatCurrency(item.realisasi)}
                          </div>
                          <div className={styles.varianceCell}>
                            Rp{formatCurrency(Math.abs(item.variance))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN (Stats + Insights) */}
            <div className={styles.rightColumn}>
              {/* QUICK STATS CARDS */}
              <div className={styles.quickStatsGrid}>
                <div className={styles.statCardPrimary}>
                  <div className={styles.statLabel}>Total Akun COA</div>
                  <div className={styles.statValue}>{totalAccounts}</div>
                </div>

                <div className={styles.statCardSuccess}>
                  <div className={styles.statLabel}>On Track</div>
                  <div className={styles.statValue}>{stats.onTrackCount}</div>
                </div>

                <div className={styles.statCardDanger}>
                  <div className={styles.statLabel}>Over Budget</div>
                  <div className={styles.statValue}>{stats.overBudgetCount}</div>
                </div>

                <div className={styles.statCardWarning}>
                  <div className={styles.statLabel}>Under-utilized</div>
                  <div className={styles.statValue}>{stats.underUtilizedCount}</div>
                </div>
              </div>

              {/* INSIGHTS CARD */}
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
                          Rata-rata Utilisasi
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
                        {realizations.length} budget items
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
                      </div>

                      <div className={styles.amountBoxOver}>
                        <div className={styles.amountLabel}>
                          Total Over Budget
                        </div>
                        <div className={styles.amountValue}>
                          Rp{formatCurrency(stats.totalOverBudget)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;