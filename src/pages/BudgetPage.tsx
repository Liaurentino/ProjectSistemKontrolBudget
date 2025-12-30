import React, { useEffect, useState } from "react";
import { BudgetForm } from "../components/BudgetForm";
import { deleteBudget, getBudgets } from "../lib/supabase";
import { useEntity } from "../contexts/EntityContext";

export const BudgetPage: React.FC = () => {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const { activeEntityIds } = useEntity();

  const fetchBudgets = async () => {
    setLoading(true);
    const { data } = await getBudgets();
    setBudgets(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  const visibleBudgets =
    activeEntityIds.length === 0
      ? []
      : budgets.filter((b) => activeEntityIds.includes(b.entity_id));

  return (
    <div className="app-container fade-in">
      <div className="app-header">
        <h1>📊 Budget Management</h1>
        <p>Hanya menampilkan budget dari entitas terpilih</p>
      </div>

      <div className="card fade-in">
        <div className="card-header">
          <h3 className="card-title">Daftar Budget</h3>
        </div>

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary mb-3"
          >
            + Tambah Budget
          </button>
        )}

        {showForm && (
          <div className="card mb-4 fade-in">
            <BudgetForm
              onSuccess={() => {
                setShowForm(false);
                fetchBudgets();
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

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
              {/* Loading */}
              {loading && (
                <tr>
                  <td colSpan={5} className="text-center">
                    Memuat data...
                  </td>
                </tr>
              )}

              {/* Kondisi 1: tidak ada entitas dicentang */}
              {!loading && activeEntityIds.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center">
                    Tidak ada entitas yang dicentang
                  </td>
                </tr>
              )}

              {/* Kondisi 2: ada entitas dicentang tapi belum ada budget */}
              {!loading &&
                activeEntityIds.length > 0 &&
                visibleBudgets.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center">
                      Belum ada budget yang dibuat untuk entitas terpilih
                    </td>
                  </tr>
                )}

              {/* Kondisi 3: ada data */}
              {!loading &&
                visibleBudgets.length > 0 &&
                visibleBudgets.map((b) => (
                  <tr key={b.id}>
                    <td>{b.entity?.entity_name}</td>
                    <td>{b.department}</td>
                    <td>{b.period}</td>
                    <td style={{ textAlign: "right" }}>
                      Rp {b.total_budget.toLocaleString("id-ID")}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={async () => {
                          if (confirm("Hapus budget ini?")) {
                            await deleteBudget(b.id);
                            fetchBudgets();
                          }
                        }}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
