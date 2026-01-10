import React, { useEffect, useState } from 'react';
import { getRealisasiByBudget } from '../lib/supabase';

interface BudgetComparisonProps {
  budgetId: string;
  totalBudget: number;
}

export const BudgetComparison: React.FC<BudgetComparisonProps> = ({ budgetId, totalBudget }) => {
  const [realisasi, setRealisasi] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRealisasi = async () => {
    setLoading(true);
    try {
      const { data, error } = await getRealisasiByBudget(budgetId);
      if (error) throw error;
      setRealisasi(data || []);
    } catch (error) {
      console.error('Error fetching realisasi:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealisasi();
  }, [budgetId]);

  const totalRealisasi = realisasi.reduce((sum, r) => sum + r.amount, 0);
  const sisaBudget = totalBudget - totalRealisasi;
  const percentageUsed = (totalRealisasi / totalBudget) * 100;

  // Tentukan warna progress bar
  const getProgressClass = () => {
    if (percentageUsed >= 100) return 'danger';
    if (percentageUsed >= 80) return 'warning';
    return '';
  };

  return (
    <div className="card fade-in">
      <div className="card-header">
        <h3 className="card-title">Perbandingan Budget vs Realisasi</h3>
      </div>

      {loading ? (
        <div className="text-center" style={{ padding: '2rem' }}>
          Memuat data...
        </div>
      ) : (
        <>
          {/* Progress Bar Section */}
          <div className="mb-4">
            <div className="flex-between mb-1">
              <span className="stat-label">Progress Penggunaan Budget</span>
              <span
                style={{
                  fontWeight: 700,
                  color: percentageUsed > 100 ? 'var(--danger-color)' : 'var(--primary-color)',
                }}
              >
                {percentageUsed.toFixed(1)}%
              </span>
            </div>
            <div className="progress-bar">
              <div
                className={`progress-fill ${getProgressClass()}`}
                style={{ width: `${Math.min(percentageUsed, 100)}%` }}
              />
            </div>

            <div className="stats-grid mt-3">
              <div className="stat-card">
                <div className="stat-label">Total Budget</div>
                <div
                  className="stat-value"
                  style={{ color: 'var(--primary-color)', fontSize: '1.25rem' }}
                >
                  Rp {totalBudget.toLocaleString('id-ID')}
                </div>
              </div>
              <div className="stat-card warning">
                <div className="stat-label">Terpakai</div>
                <div
                  className="stat-value"
                  style={{ color: 'var(--warning-color)', fontSize: '1.25rem' }}
                >
                  Rp {totalRealisasi.toLocaleString('id-ID')}
                </div>
              </div>
              <div className={`stat-card ${sisaBudget >= 0 ? 'success' : 'danger'}`}>
                <div className="stat-label">Sisa</div>
                <div className="stat-value" style={{ fontSize: '1.25rem' }}>
                  Rp {sisaBudget.toLocaleString('id-ID')}
                </div>
              </div>
            </div>
          </div>

          {/* Detail Realisasi */}
          {realisasi.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-3" style={{ fontSize: '1rem', fontWeight: 600 }}>
                Rincian Pengeluaran Terakhir
              </h4>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Kategori</th>
                      <th>Deskripsi</th>
                      <th style={{ textAlign: 'right' }}>Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {realisasi.slice(0, 5).map((r) => (
                      <tr key={r.id}>
                        <td>{new Date(r.date).toLocaleDateString('id-ID')}</td>
                        <td>{r.category || '-'}</td>
                        <td>{r.description || '-'}</td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 600,
                            color: 'var(--primary-dark)',
                          }}
                        >
                          Rp {r.amount.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {realisasi.length > 5 && (
                <p className="text-center mt-2" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Menampilkan 5 dari {realisasi.length} transaksi
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};