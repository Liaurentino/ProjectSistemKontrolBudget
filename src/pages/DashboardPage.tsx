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
        <div style={{
          backgroundColor: 'white',
          padding: '12px',
          border: '1px solid #dee2e6',
          borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#495057' }}>
            {payload[0].payload.period}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ margin: '4px 0', fontSize: '13px', color: entry.color }}>
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
          {/* RECHARTS Section */}
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '16px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
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

          {/* Bottom Section - sama seperti sebelumnya */}
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
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
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

            {/* Insights & Statistics */}
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              padding: '24px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
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
                  {/* Average Utilization */}
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