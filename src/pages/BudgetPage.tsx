import React, { useEffect, useState } from 'react';
import { BudgetForm } from '../components/BudgetForm';
import { deleteBudget, getBudgets } from '../lib/supabase';

export const BudgetPage: React.FC = () => {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchBudgets = async () => {
    setLoading(true);
    const { data } = await getBudgets();
    setBudgets(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  return (
    <div className="app-container fade-in">
      <div className="app-header">
        <h1>📊 Budget Management</h1>
        <p>Kelola budget dan alokasi kategori perusahaan</p>
      </div>

      <div className="card fade-in">
        <div className="card-header">
          <h3 className="card-title">Daftar Budget</h3>
        </div>

        {/* Button Toggle Form */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary mb-3"
          >
            + Tambah Budget
          </button>
        )}

        {/* Budget Form */}
        {showForm && (
          <div
            className="card mb-4 fade-in"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border-color)",
            }}
          >
            <BudgetForm
              onSuccess={() => {
                setShowForm(false);
                fetchBudgets();
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {/* Budget Table */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Department</th>
                <th>Periode</th>
                <th style={{ textAlign: "right" }}>Total Budget</th>
                <th style={{ textAlign: "center" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && !budgets.length ? (
                <tr>
                  <td colSpan={5} className="text-center">
                    Memuat data...
                  </td>
                </tr>
              ) : budgets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center">
                    Belum ada data budget
                  </td>
                </tr>
              ) : (
                budgets.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>
                      {b.entity?.entity_name || '-'}
                    </td>
                    <td>{b.department}</td>
                    <td>{b.period}</td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 600,
                        color: "var(--primary-dark)",
                      }}
                    >
                      Rp {b.total_budget.toLocaleString("id-ID")}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        onClick={async () => {
                          if (confirm("Yakin ingin menghapus budget ini?")) {
                            await deleteBudget(b.id);
                            fetchBudgets();
                          }
                        }}
                        className="btn btn-danger btn-sm"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};