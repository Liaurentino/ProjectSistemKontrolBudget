import React, { useEffect, useState } from "react";
import { getBudgets } from "../lib/supabase";
import { RealisasiTable } from "../components/RealisasiTabel";
import { useEntity } from "../contexts/EntityContext";

export const RealisasiPage: React.FC = () => {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);

  const { activeEntityIds } = useEntity();

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const { data } = await getBudgets();
      setBudgets(data || []);
    } catch (error) {
      console.error("Error fetching budgets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  // filter sesuai entitas yang dicentang
  const filteredBudgets =
    activeEntityIds.length === 0
      ? []
      : budgets.filter((b) => activeEntityIds.includes(b.entity?.id));

  // jaga selected budget tetap valid
  useEffect(() => {
    if (filteredBudgets.length === 0) {
      setSelectedBudgetId(null);
      return;
    }

    if (!selectedBudgetId) {
      setSelectedBudgetId(filteredBudgets[0].id);
      return;
    }

    const stillExists = filteredBudgets.some(
      (b) => b.id === selectedBudgetId
    );

    if (!stillExists) {
      setSelectedBudgetId(filteredBudgets[0].id);
    }
  }, [filteredBudgets, selectedBudgetId]);

  const selectedBudget = filteredBudgets.find(
    (b) => b.id === selectedBudgetId
  );

  return (
    <div className="app-container fade-in">
      <div className="app-header">
        <h1>
          <span className="icon">📈</span>
          Monitoring Realisasi
        </h1>
        <p>Bandingkan rencana budget dengan pengeluaran aktual</p>
      </div>

      {/* KONDISI 1: tidak ada entitas dicentang */}
      {activeEntityIds.length === 0 && (
        <div className="card card-center">
          <p>Tidak ada entitas yang dicentang</p>
        </div>
      )}

      {/* KONDISI 2: entitas dicentang tapi tidak ada budget */}
      {activeEntityIds.length > 0 && filteredBudgets.length === 0 && (
        <div className="card card-center">
          <p>Belum ada budget yang dibuat untuk entitas terpilih</p>
        </div>
      )}

      {/* KONDISI 3: ada budget yang cocok, tampilkan daftar saja */}
      {!loading && filteredBudgets.length > 0 && (
        <div className="card fade in mb-4">
          <h2 className="card-title mb-2">Pilih Anggaran Perusahaan</h2>

          <div className="stats-grid">
            {filteredBudgets.map((budget) => (
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
      ) : null}
    </div>
  );
};