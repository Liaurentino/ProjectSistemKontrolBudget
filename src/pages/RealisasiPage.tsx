import React, { useEffect, useState } from "react";
import { getBudgets } from "../lib/supabase";
import { RealisasiTable } from "../components/RealisasiTabel";
import { useEntity } from "../contexts/EntityContext";

export const RealisasiPage: React.FC = () => {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);

  // ✅ Ambil entities dan activeEntityIds dari context
  const { entities, activeEntityIds } = useEntity();

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

  // hanya budget milik entitas yang aktif
  const filteredBudgets =
    activeEntityIds.length === 0
      ? []
      : budgets.filter((b) => activeEntityIds.includes(b.entity?.id));

  // auto pilih budget pertama
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
  }, [filteredBudgets]);

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

      {activeEntityIds.length === 0 && (
        <div className="card card-center">
          <p>Tidak ada entitas yang dicentang. Silakan centang entitas di halaman Entitas terlebih dahulu.</p>
        </div>
      )}

      {activeEntityIds.length > 0 && filteredBudgets.length === 0 && (
        <div className="card card-center">
          <p>Belum ada budget untuk entitas terpilih</p>
        </div>
      )}

      {loading ? (
        <div className="spinner" />
      ) : selectedBudget ? (
        <RealisasiTable
          budgetId={selectedBudget.id}
          categories={selectedBudget.categories_data || []}
          budgets={filteredBudgets}
          selectedBudgetId={selectedBudgetId}
          onChangeBudget={setSelectedBudgetId}
        />
      ) : null}
    </div>
  );
};