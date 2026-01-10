import React, { useEffect, useState } from "react";
import { getBudgets, getEntities } from "../lib/supabase"; // ⬅️ tambahkan getEntities
import { RealisasiTable } from "../components/RealisasiTabel";
import { useEntity } from "../contexts/EntityContext";

export const RealisasiPage: React.FC = () => {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]); // ⬅️ tambahkan state entities
  const [loading, setLoading] = useState(false);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);

  const { activeEntityIds } = useEntity(); // ⬅️ hapus entities dari sini

  // ⬅️ tambahkan fetch entities
  const fetchEntities = async () => {
    const { data, error } = await getEntities();
    if (!error) setEntities(data || []);
  };

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
    fetchEntities(); // ⬅️ panggil fetch entities
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
          <p>Tidak ada entitas yang dicentang</p>
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
          entities={entities}              
          activeEntityIds={activeEntityIds}
          selectedBudgetId={selectedBudgetId}
          onChangeBudget={setSelectedBudgetId}
        />
      ) : null}
    </div>
  );
};