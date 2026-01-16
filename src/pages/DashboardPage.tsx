import React, { useState, useEffect } from 'react';
import { useEntity } from '../contexts/EntityContext';
import {
  getBudgetRealizationsLive,
  getLocalAccounts,
  type BudgetRealization,
} from '../lib/accurate';

// Helper: Format currency
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('id-ID');
};

// Interface untuk data chart
interface ChartDataPoint {
  period: string;
  budget: number;
  realisasi: number;
}

// Interface untuk over budget warning
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

  // State
  const [realizations, setRealizations] = useState<BudgetRealization[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [overBudgetItems, setOverBudgetItems] = useState<OverBudgetItem[]>([]);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Statistics
  const [stats, setStats] = useState({
    totalBudget: 0,
    totalRealisasi: 0,
    utilizationPercentage: 0,
    overBudgetCount: 0,
    onTrackCount: 0,
  });

  // Load data
  useEffect(() => {
    if (activeEntity?.id) {
      loadDashboardData();
    } else {
      // Reset state when no entity
      setRealizations([]);
      setChartData([]);
      setOverBudgetItems([]);
      setTotalAccounts(0);
      setStats({
        totalBudget: 0,
        totalRealisasi: 0,
        utilizationPercentage: 0,
        overBudgetCount: 0,
        onTrackCount: 0,
      });
    }
  }, [activeEntity?.id]);

  const loadDashboardData = async () => {
    if (!activeEntity) return;

    setLoading(true);
    setError(null);

    try {
      // Load budget realizations
      const { data: realizationsData, error: realizationsError } = 
        await getBudgetRealizationsLive(activeEntity.id);

      if (realizationsError) throw realizationsError;

      setRealizations(realizationsData || []);

      // Load total accounts from COA
      const { data: accountsData, error: accountsError } = 
        await getLocalAccounts(activeEntity.id);

      if (accountsError) throw accountsError;
      setTotalAccounts(accountsData?.length || 0);

      // Process data
      if (realizationsData && realizationsData.length > 0) {
        processChartData(realizationsData);
        processOverBudgetItems(realizationsData);
        calculateStatistics(realizationsData);
      } else {
        setChartData([]);
        setOverBudgetItems([]);
        setStats({
          totalBudget: 0,
          totalRealisasi: 0,
          utilizationPercentage: 0,
          overBudgetCount: 0,
          onTrackCount: 0,
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

  // Process data for chart (group by period)
  const processChartData = (data: BudgetRealization[]) => {
    const periodMap = new Map<string, { budget: number; realisasi: number }>();

    data.forEach(item => {
      const existing = periodMap.get(item.period) || { budget: 0, realisasi: 0 };
      periodMap.set(item.period, {
        budget: existing.budget + item.budget_allocated,
        realisasi: existing.realisasi + item.realisasi,
      });
    });

    // Convert to array and sort by period
    const chartPoints: ChartDataPoint[] = Array.from(periodMap.entries())
      .map(([period, values]) => ({
        period,
        budget: values.budget,
        realisasi: values.realisasi,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    setChartData(chartPoints);
  };

  // Process over budget items
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
      .sort((a, b) => a.variance - b.variance) // Sort by worst first (most negative)
      .slice(0, 5); // Top 5 worst

    setOverBudgetItems(overBudget);
  };

  // Calculate statistics
  const calculateStatistics = (data: BudgetRealization[]) => {
    const totalBudget = data.reduce((sum, item) => sum + item.budget_allocated, 0);
    const totalRealisasi = data.reduce((sum, item) => sum + item.realisasi, 0);
    const utilizationPercentage = totalBudget > 0 
      ? Math.min((totalRealisasi / totalBudget) * 100, 100) 
      : 0;
    const overBudgetCount = data.filter(item => item.status === 'OVER_BUDGET').length;
    const onTrackCount = data.filter(item => item.status === 'ON_TRACK').length;

    setStats({
      totalBudget,
      totalRealisasi,
      utilizationPercentage,
      overBudgetCount,
      onTrackCount,
    });
  };

  // Calculate max value for chart scaling
  const maxChartValue = Math.max(
    ...chartData.flatMap(d => [d.budget, d.realisasi]),
    0
  );

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }}>📊 Dashboard</h2>
        <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6c757d' }}>
          Ringkasan Budget vs Realisasi
        </p>
        {activeEntity && (
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6c757d' }}>
            Entitas: <strong>{activeEntity.entity_name || activeEntity.name}</strong>
          </p>
        )}
      </div>

      {/* No Entity Warning */}
      {!activeEntity && (
        <div style={{
          padding: '60px 20px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
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

      {/* Main Content */}
      {activeEntity && (
        <>
          {/* Chart Section */}
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '16px',
          }}>
            <h3 style={{ 
              margin: '0 0 20px', 
              fontSize: '18px', 
              fontWeight: 600,
              color: '#495057',
            }}>
              Budget vs Realisasi Over Time
            </h3>

            {loading ? (
              <div style={{ 
                padding: '60px 20px', 
                textAlign: 'center', 
                color: '#6c757d' 
              }}>
                ⏳ Memuat data...
              </div>
            ) : chartData.length === 0 ? (
              <div style={{ 
                padding: '60px 20px', 
                textAlign: 'center', 
                color: '#6c757d' 
              }}>
                📋 Belum ada data budget. Silakan buat budget terlebih dahulu.
              </div>
            ) : (
              <div style={{ width: '100%', overflowX: 'auto' }}>
                {/* Chart */}
                <div style={{ minWidth: '600px', height: '300px', position: 'relative' }}>
                  {/* Y-axis labels */}
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 40,
                    width: '80px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    paddingRight: '8px',
                  }}>
                    <div style={{ fontSize: '12px', color: '#6c757d', textAlign: 'right' }}>
                      Rp{formatCurrency(maxChartValue)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6c757d', textAlign: 'right' }}>
                      Rp{formatCurrency(maxChartValue * 0.75)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6c757d', textAlign: 'right' }}>
                      Rp{formatCurrency(maxChartValue * 0.5)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6c757d', textAlign: 'right' }}>
                      Rp{formatCurrency(maxChartValue * 0.25)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6c757d', textAlign: 'right' }}>
                      Rp0
                    </div>
                  </div>

                  {/* Chart area */}
                  <div style={{
                    position: 'absolute',
                    left: '90px',
                    right: 0,
                    top: 0,
                    bottom: 40,
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '24px',
                    paddingRight: '20px',
                    borderBottom: '2px solid #dee2e6',
                    borderLeft: '2px solid #dee2e6',
                  }}>
                    {/* Horizontal grid lines */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      bottom: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      pointerEvents: 'none',
                    }}>
                      {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} style={{
                          width: '100%',
                          height: '1px',
                          backgroundColor: '#e9ecef',
                        }} />
                      ))}
                    </div>

                    {/* Bars */}
                    {chartData.map((point, index) => {
                      const budgetHeight = maxChartValue > 0 
                        ? (point.budget / maxChartValue) * 100 
                        : 0;
                      const realisasiHeight = maxChartValue > 0 
                        ? (point.realisasi / maxChartValue) * 100 
                        : 0;

                      return (
                        <div key={index} style={{
                          flex: 1,
                          display: 'flex',
                          gap: '8px',
                          height: '100%',
                          alignItems: 'flex-end',
                        }}>
                          {/* Budget bar */}
                          <div style={{
                            flex: 1,
                            height: `${budgetHeight}%`,
                            backgroundColor: '#007bff',
                            borderRadius: '4px 4px 0 0',
                            position: 'relative',
                            minHeight: budgetHeight > 0 ? '4px' : '0',
                          }}>
                            <div style={{
                              position: 'absolute',
                              top: '-24px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              fontSize: '11px',
                              color: '#007bff',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}>
                              {budgetHeight > 5 ? formatCurrency(point.budget) : ''}
                            </div>
                          </div>

                          {/* Realisasi bar */}
                          <div style={{
                            flex: 1,
                            height: `${realisasiHeight}%`,
                            backgroundColor: point.realisasi > point.budget ? '#dc3545' : '#28a745',
                            borderRadius: '4px 4px 0 0',
                            position: 'relative',
                            minHeight: realisasiHeight > 0 ? '4px' : '0',
                          }}>
                            <div style={{
                              position: 'absolute',
                              top: '-24px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              fontSize: '11px',
                              color: point.realisasi > point.budget ? '#dc3545' : '#28a745',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}>
                              {realisasiHeight > 5 ? formatCurrency(point.realisasi) : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* X-axis labels */}
                  <div style={{
                    position: 'absolute',
                    left: '90px',
                    right: 0,
                    bottom: 0,
                    height: '40px',
                    display: 'flex',
                    gap: '24px',
                    paddingRight: '20px',
                  }}>
                    {chartData.map((point, index) => (
                      <div key={index} style={{
                        flex: 1,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        fontSize: '12px',
                        color: '#495057',
                        fontWeight: 500,
                      }}>
                        {point.period}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '24px',
                  marginTop: '24px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: '#007bff',
                      borderRadius: '2px',
                    }} />
                    <span style={{ fontSize: '14px', color: '#495057' }}>Budget</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: '#28a745',
                      borderRadius: '2px',
                    }} />
                    <span style={{ fontSize: '14px', color: '#495057' }}>Realisasi (On Track)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: '#dc3545',
                      borderRadius: '2px',
                    }} />
                    <span style={{ fontSize: '14px', color: '#495057' }}>Realisasi (Over Budget)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Section: Warnings & Insights */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
          }}>
            {/* Over Budget Warnings */}
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              padding: '24px',
            }}>
              <h3 style={{ 
                margin: '0 0 16px', 
                fontSize: '18px', 
                fontWeight: 600,
                color: '#495057',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                ⚠️ Peringatan Over Budget
              </h3>

              {loading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
                  Memuat...
                </div>
              ) : overBudgetItems.length === 0 ? (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  backgroundColor: '#d4edda',
                  borderRadius: '6px',
                  color: '#155724',
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
                  <div style={{ fontWeight: 600 }}>Semua Budget On Track!</div>
                  <div style={{ fontSize: '14px', marginTop: '4px' }}>
                    Tidak ada akun yang melebihi budget
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {overBudgetItems.map((item, index) => (
                    <div key={index} style={{
                      padding: '12px',
                      backgroundColor: '#fff3cd',
                      border: '1px solid #ffc107',
                      borderRadius: '6px',
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                      }}>
                        <span style={{ 
                          fontWeight: 600, 
                          fontSize: '14px',
                          color: '#856404',
                        }}>
                          {item.account_code}
                        </span>
                        <span style={{
                          fontSize: '12px',
                          color: '#856404',
                          backgroundColor: '#fff',
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}>
                          {item.period}
                        </span>
                      </div>
                      <div style={{ 
                        fontSize: '13px', 
                        color: '#856404',
                        marginBottom: '8px',
                      }}>
                        {item.account_name}
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        fontSize: '12px',
                      }}>
                        <div>
                          <div style={{ color: '#6c757d' }}>Budget:</div>
                          <div style={{ fontWeight: 600, color: '#495057' }}>
                            Rp{formatCurrency(item.budget)}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#6c757d' }}>Realisasi:</div>
                          <div style={{ fontWeight: 600, color: '#dc3545' }}>
                            Rp{formatCurrency(item.realisasi)}
                          </div>
                        </div>
                      </div>
                      <div style={{
                        marginTop: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#dc3545',
                      }}>
                        Over: Rp{formatCurrency(Math.abs(item.variance))} 
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Insights & Statistics */}
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              padding: '24px',
            }}>
              <h3 style={{ 
                margin: '0 0 16px', 
                fontSize: '18px', 
                fontWeight: 600,
                color: '#495057',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                📈 Insight & Statistik
              </h3>

              {loading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
                  Memuat...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Utilization Progress Bar */}
                  <div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#495057' }}>
                        Tingkat Utilisasi Budget
                      </span>
                      <span style={{ 
                        fontSize: '14px', 
                        fontWeight: 600,
                        color: stats.utilizationPercentage > 100 ? '#dc3545' : '#28a745',
                      }}>
                        {stats.utilizationPercentage.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '24px',
                      backgroundColor: '#e9ecef',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}>
                      <div style={{
                        width: `${Math.min(stats.utilizationPercentage, 100)}%`,
                        height: '100%',
                        backgroundColor: stats.utilizationPercentage > 100 
                          ? '#dc3545' 
                          : stats.utilizationPercentage > 80 
                          ? '#ffc107' 
                          : '#28a745',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: '8px',
                      fontSize: '12px',
                      color: '#6c757d',
                    }}>
                      <span>Rp{formatCurrency(stats.totalRealisasi)}</span>
                      <span>/ Rp{formatCurrency(stats.totalBudget)}</span>
                    </div>
                  </div>

                  {/* Statistics Cards */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                  }}>
                    {/* Total Accounts from COA */}
                    <div style={{
                      padding: '16px',
                      backgroundColor: '#e7f3ff',
                      borderRadius: '6px',
                      border: '1px solid #b3d9ff',
                    }}>
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#004085',
                        marginBottom: '4px',
                      }}>
                        Jumlah Akun Perkiraan
                      </div>
                      <div style={{ 
                        fontSize: '24px', 
                        fontWeight: 600,
                        color: '#004085',
                      }}>
                        {totalAccounts}
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#004085',
                        marginTop: '4px',
                      }}>
                        akun dari COA
                      </div>
                    </div>

                    {/* On Track Count */}
                    <div style={{
                      padding: '16px',
                      backgroundColor: '#d4edda',
                      borderRadius: '6px',
                      border: '1px solid #c3e6cb',
                    }}>
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#155724',
                        marginBottom: '4px',
                      }}>
                        Akun On Track
                      </div>
                      <div style={{ 
                        fontSize: '24px', 
                        fontWeight: 600,
                        color: '#155724',
                      }}>
                        {stats.onTrackCount}
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#155724',
                        marginTop: '4px',
                      }}>
                        dalam budget
                      </div>
                    </div>

                    {/* Over Budget Count */}
                    <div style={{
                      padding: '16px',
                      backgroundColor: '#f8d7da',
                      borderRadius: '6px',
                      border: '1px solid #f5c6cb',
                    }}>
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#721c24',
                        marginBottom: '4px',
                      }}>
                        Akun Over Budget
                      </div>
                      <div style={{ 
                        fontSize: '24px', 
                        fontWeight: 600,
                        color: '#721c24',
                      }}>
                        {stats.overBudgetCount}
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#721c24',
                        marginTop: '4px',
                      }}>
                        melebihi budget
                      </div>
                    </div>

                    {/* Total Budget Items */}
                    <div style={{
                      padding: '16px',
                      backgroundColor: '#fff3cd',
                      borderRadius: '6px',
                      border: '1px solid #ffc107',
                    }}>
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#856404',
                        marginBottom: '4px',
                      }}>
                        Total Budget Items
                      </div>
                      <div style={{ 
                        fontSize: '24px', 
                        fontWeight: 600,
                        color: '#856404',
                      }}>
                        {realizations.length}
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#856404',
                        marginTop: '4px',
                      }}>
                        item budget
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