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
      {/* ===== HEADER ===== */}
      <div className="app-header">
        <h1>📊 Budget Management</h1>
        <p>Kelola budget dan alokasi kategori perusahaan</p>
      </div>

      {/* ===== ACTION BUTTON ===== */}
      {!showForm && (
        <div className="page-action">
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(true)}
          >
            + Tambah Budget
          </button>
        </div>
      )}

      {/* ===== FORM SECTION ===== */}
      {showForm && (
        <div className="card form-wrapper mb-4">
          <BudgetForm
            onSuccess={() => {
              setShowForm(false);
              fetchBudgets();
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* ===== LIST HEADER ===== */}
      <h2 className="card-title mb-3">Daftar Budget</h2>

      {/* ===== CONTENT ===== */}
      {loading ? (
        <div className="spinner" />
      ) : budgets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">Belum ada budget</div>
          <div className="empty-state-desc">
            Klik tombol Tambah Budget untuk membuat data baru
          </div>
        </div>
      ) : (
        <div className="budget-list">
          {budgets.map(b => (
            <div key={b.id} className="card budget-card mb-3">
              <div className="budget-card-header">
                <h3 className="budget-entity">{b.entity}</h3>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={async () => {
                    if (confirm('Hapus budget ini?')) {
                      await deleteBudget(b.id);
                      fetchBudgets();
                    }
                  }}
                >
                  Hapus
                </button>
              </div>

              <div className="budget-meta">
                <span>{b.department}</span>
                <span>•</span>
                <span>{b.period}</span>
              </div>

              <div className="budget-amount">
                Rp {b.total_budget.toLocaleString('id-ID')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
