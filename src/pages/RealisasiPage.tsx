import React, { useEffect, useState } from "react";
import { getBudgets } from "../lib/supabase";
import { RealisasiTable } from "../components/RealisasiTabel";

export const RealisasiPage: React.FC = () => {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const { data, error } = await getBudgets();
      if (error) throw error;
      setBudgets(data || []);
      if (data && data.length > 0) {
        setSelectedBudgetId(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching budgets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  const selectedBudget = budgets.find((b) => b.id === selectedBudgetId);

  return (
    <div className="app-container fade-in">
      <div className="app-header">
        <h1>
          <span className="icon">📈</span>
          Monitoring Realisasi
        </h1>
        <p>Bandingkan rencana budget dengan pengeluaran aktual Anda</p>
      </div>

      {!loading && budgets.length > 0 && (
        <div className="card mb-3">
          <h2 className="card-title mb-2">Pilih Anggaran Perusahaan</h2>
          <div className="stats-grid">
            {budgets.map((budget) => (
              <div
                key={budget.id}
                onClick={() => setSelectedBudgetId(budget.id)}
                className={`budget-item ${
                  selectedBudgetId === budget.id ? "active" : ""
                }`}
                style={{ cursor: "pointer" }}
              >
                <p className="budget-item-title">
                  {budget.entity?.entity_name || "-"}
                </p>
                <p className="budget-item-meta">
                  {budget.department} | {budget.period}
                </p>
                <p className="budget-item-amount">
                  Rp {budget.total_budget.toLocaleString("id-ID")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="spinner" />
      ) : selectedBudget ? (
        <RealisasiTable
          budgetId={selectedBudget.id}
          categories={selectedBudget.categories_data}
        />
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <div className="empty-state-title">Tidak ada budget terpilih</div>
          <p>Silakan pilih atau buat budget terlebih dahulu.</p>
        </div>
      )}
    </div>
  );
};
