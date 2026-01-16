import React, { useState, useEffect } from 'react';
import { useEntity } from '../contexts/EntityContext';
import {
  getBudgetRealizationsLive,
  getLocalAccounts,
  type BudgetRealization,
} from '../lib/accurate';

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

  // BETTER STATISTICS
  const [stats, setStats] = useState({
    totalBudget: 0,
    totalRealisasi: 0,
    averageUtilization: 0, // Average per item (lebih akurat!)
    totalUnutilized: 0, // Total sisa budget yang belum terpakai
    totalOverBudget: 0, // Total yang over budget
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

  // BETTER STATISTICS CALCULATION
  const calculateBetterStatistics = (data: BudgetRealization[]) => {
    const totalBudget = data.reduce((sum, item) => sum + item.budget_allocated, 0);
    const totalRealisasi = data.reduce((sum, item) => sum + item.realisasi, 0);
    
    // Calculate utilization per item
    const utilizationRates = data.map(item => {
      if (item.budget_allocated === 0) return 0;
      return (item.realisasi / item.budget_allocated) * 100;
    });
    
    // Average utilization (lebih akurat!)
    const averageUtilization = utilizationRates.length > 0
      ? utilizationRates.reduce((sum, rate) => sum + rate, 0) / utilizationRates.length
      : 0;
    
    // Total unutilized (budget yang belum terpakai)
    const totalUnutilized = data.reduce((sum, item) => {
      const unutilized = item.budget_allocated - item.realisasi;
      return sum + (unutilized > 0 ? unutilized : 0);
    }, 0);
    
    // Total over budget (total yang melebihi budget)
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

  const maxChartValue = Math.max(
    ...chartData.flatMap(d => [d.budget, d.realisasi]),
    0
  );

  // Generate SVG path for line chart
  const generateLinePath = (points: ChartDataPoint[], key: 'budget' | 'realisasi', width: number, height: number) => {
    if (points.length === 0) return '';
    
    const xStep = width / (points.length - 1 || 1);
    
    const pathPoints = points.map((point, index) => {
      const x = index * xStep;
      const value = point[key];
      const y = height - (maxChartValue > 0 ? (value / maxChartValue) * height : 0);
      return { x, y };
    });
    
    // Create smooth curve using quadratic bezier
    let path = `M ${pathPoints[0].x} ${pathPoints[0].y}`;
    
    for (let i = 1; i < pathPoints.length; i++) {
      const prev = pathPoints[i - 1];
      const curr = pathPoints[i];
      const midX = (prev.x + curr.x) / 2;
      
      path += ` Q ${prev.x} ${prev.y} ${midX} ${(prev.y + curr.y) / 2}`;
      path += ` Q ${curr.x} ${curr.y} ${curr.x} ${curr.y}`;
    }
    
    return path;
  };

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
          {/* COMBINATION CHART Section (Bar + Line) */}
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
              Budget vs Realisasi
            </h3>

            {loading ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#6c757d' }}>
                ⏳ Memuat data...
              </div>
            ) : chartData.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#6c757d' }}>
                📋 Belum ada data budget. Silakan buat budget terlebih dahulu.
              </div>
            ) : (
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <svg 
                  width="100%" 
                  height="320" 
                  style={{ minWidth: '600px' }}
                  viewBox="0 0 800 320"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Grid lines */}
                  {[0, 1, 2, 3, 4].map(i => (
                    <line
                      key={i}
                      x1="80"
                      y1={40 + i * 55}
                      x2="780"
                      y2={40 + i * 55}
                      stroke="#e9ecef"
                      strokeWidth="1"
                    />
                  ))}
                  
                  {/* Y-axis labels */}
                  {[0, 1, 2, 3, 4].map(i => {
                    const value = maxChartValue * (1 - i * 0.25);
                    return (
                      <text
                        key={i}
                        x="70"
                        y={44 + i * 55}
                        textAnchor="end"
                        fontSize="11"
                        fill="#6c757d"
                      >
                        {formatCurrency(Math.round(value))}
                      </text>
                    );
                  })}
                  
                  {/* Budget Bars */}
                  {chartData.map((point, index) => {
                    const barWidth = 40;
                    const x = 80 + (index * 700 / chartData.length) + (700 / chartData.length - barWidth) / 2;
                    const barHeight = maxChartValue > 0 ? (point.budget / maxChartValue) * 220 : 0;
                    const y = 40 + (220 - barHeight);
                    
                    return (
                      <rect
                        key={`bar-${index}`}
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        fill="#007bff"
                        opacity="0.7"
                        rx="3"
                      />
                    );
                  })}
                  
                  {/* Variance Shaded Areas */}
                  {chartData.map((point, index) => {
                    const barWidth = 40;
                    const x = 80 + (index * 700 / chartData.length) + (700 / chartData.length - barWidth) / 2;
                    const budgetHeight = maxChartValue > 0 ? (point.budget / maxChartValue) * 220 : 0;
                    const realisasiHeight = maxChartValue > 0 ? (point.realisasi / maxChartValue) * 220 : 0;
                    const budgetY = 40 + (220 - budgetHeight);
                    const realisasiY = 40 + (220 - realisasiHeight);
                    
                    const isOver = point.realisasi > point.budget;
                    const rectY = isOver ? budgetY : realisasiY;
                    const rectHeight = Math.abs(budgetHeight - realisasiHeight);
                    
                    return (
                      <rect
                        key={`variance-${index}`}
                        x={x}
                        y={rectY}
                        width={barWidth}
                        height={rectHeight}
                        fill={isOver ? '#dc3545' : '#28a745'}
                        opacity="0.25"
                      />
                    );
                  })}
                  
                  {/* Realisasi Line */}
                  <path
                    d={generateLinePath(chartData, 'realisasi', 700, 220)}
                    fill="none"
                    stroke="#28a745"
                    strokeWidth="3"
                    transform="translate(80, 40)"
                  />
                  
                  {/* Data points - Realisasi */}
                  {chartData.map((point, index) => {
                    const x = 80 + (index * 700 / (chartData.length - 1 || 1));
                    const y = 40 + (220 - (maxChartValue > 0 ? (point.realisasi / maxChartValue) * 220 : 0));
                    const isOver = point.realisasi > point.budget;
                    return (
                      <circle
                        key={`real-${index}`}
                        cx={x}
                        cy={y}
                        r="5"
                        fill={isOver ? '#dc3545' : '#28a745'}
                        stroke="white"
                        strokeWidth="2"
                      />
                    );
                  })}
                  
                  {/* X-axis labels */}
                  {chartData.map((point, index) => {
                    const x = 80 + (index * 700 / chartData.length) + (700 / chartData.length) / 2;
                    return (
                      <text
                        key={`label-${index}`}
                        x={x}
                        y="285"
                        textAnchor="middle"
                        fontSize="12"
                        fill="#495057"
                        fontWeight="500"
                      >
                        {point.period}
                      </text>
                    );
                  })}
                  
                  {/* Axes */}
                  <line x1="80" y1="260" x2="780" y2="260" stroke="#495057" strokeWidth="2" />
                  <line x1="80" y1="40" x2="80" y2="260" stroke="#495057" strokeWidth="2" />
                </svg>

                {/* Legend */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '24px',
                  marginTop: '16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '24px',
                      height: '12px',
                      backgroundColor: '#007bff',
                      opacity: '0.7',
                      borderRadius: '2px',
                    }} />
                    <span style={{ fontSize: '14px', color: '#495057' }}>Budget (Bar)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '24px',
                      height: '3px',
                      backgroundColor: '#28a745',
                    }} />
                    <span style={{ fontSize: '14px', color: '#495057' }}>Realisasi (Line)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '16px',
                      height: '12px',
                      backgroundColor: '#dc3545',
                      opacity: '0.25',
                      borderRadius: '2px',
                    }} />
                    <span style={{ fontSize: '14px', color: '#495057' }}>Over Budget</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Section */}
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
                        <span style={{ fontWeight: 600, fontSize: '14px', color: '#856404' }}>
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
                      <div style={{ fontSize: '13px', color: '#856404', marginBottom: '8px' }}>
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

            {/* BETTER Insights & Statistics */}
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
                  {/* AVERAGE Utilization (Lebih Akurat!) */}
                  <div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#495057' }}>
                        Rata-rata Utilisasi per Item
                      </span>
                      <span style={{ 
                        fontSize: '14px', 
                        fontWeight: 600,
                        color: stats.averageUtilization > 100 ? '#dc3545' : '#28a745',
                      }}>
                        {stats.averageUtilization.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '24px',
                      backgroundColor: '#e9ecef',
                      borderRadius: '12px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${Math.min(stats.averageUtilization, 100)}%`,
                        height: '100%',
                        backgroundColor: stats.averageUtilization > 100 
                          ? '#dc3545' 
                          : stats.averageUtilization > 80 
                          ? '#ffc107' 
                          : '#28a745',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    <div style={{
                      marginTop: '6px',
                      fontSize: '11px',
                      color: '#6c757d',
                    }}>
                      💡 Rata-rata dari {realizations.length} budget items
                    </div>
                  </div>

                  {/* Unutilized & Over Budget Amounts */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                  }}>
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#fff3cd',
                      borderRadius: '6px',
                      border: '1px solid #ffc107',
                    }}>
                      <div style={{ fontSize: '11px', color: '#856404', marginBottom: '4px' }}>
                        Unutilized Budget
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 600, color: '#856404' }}>
                        Rp{formatCurrency(stats.totalUnutilized)}
                      </div>
                      <div style={{ fontSize: '10px', color: '#856404', marginTop: '4px' }}>
                        belum terpakai
                      </div>
                    </div>

                    <div style={{
                      padding: '12px',
                      backgroundColor: '#f8d7da',
                      borderRadius: '6px',
                      border: '1px solid #f5c6cb',
                    }}>
                      <div style={{ fontSize: '11px', color: '#721c24', marginBottom: '4px' }}>
                        Total Over Budget
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 600, color: '#721c24' }}>
                        Rp{formatCurrency(stats.totalOverBudget)}
                      </div>
                      <div style={{ fontSize: '10px', color: '#721c24', marginTop: '4px' }}>
                        melebihi budget
                      </div>
                    </div>
                  </div>

                  {/* Distribution Cards */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                  }}>
                    <div style={{
                      padding: '16px',
                      backgroundColor: '#e7f3ff',
                      borderRadius: '6px',
                      border: '1px solid #b3d9ff',
                    }}>
                      <div style={{ fontSize: '12px', color: '#004085', marginBottom: '4px' }}>
                        Total Akun COA
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 600, color: '#004085' }}>
                        {totalAccounts}
                      </div>
                    </div>

                    <div style={{
                      padding: '16px',
                      backgroundColor: '#d4edda',
                      borderRadius: '6px',
                      border: '1px solid #c3e6cb',
                    }}>
                      <div style={{ fontSize: '12px', color: '#155724', marginBottom: '4px' }}>
                        On Track
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 600, color: '#155724' }}>
                        {stats.onTrackCount}
                      </div>
                    </div>

                    <div style={{
                      padding: '16px',
                      backgroundColor: '#f8d7da',
                      borderRadius: '6px',
                      border: '1px solid #f5c6cb',
                    }}>
                      <div style={{ fontSize: '12px', color: '#721c24', marginBottom: '4px' }}>
                        Over Budget
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 600, color: '#721c24' }}>
                        {stats.overBudgetCount}
                      </div>
                    </div>

                    <div style={{
                      padding: '16px',
                      backgroundColor: '#fff3cd',
                      borderRadius: '6px',
                      border: '1px solid #ffc107',
                    }}>
                      <div style={{ fontSize: '12px', color: '#856404', marginBottom: '4px' }}>
                        Under-utilized
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 600, color: '#856404' }}>
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