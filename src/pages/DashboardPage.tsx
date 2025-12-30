import React, { useEffect, useState } from "react";
import { getBudgets } from "../lib/supabase";
import { BudgetComparison } from "../components/BudgetComparison";
import { useEntity } from "../contexts/EntityContext";

export const ComparisonPage: React.FC = () => {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);

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

  // Filter sesuai entitas yang dicentang
  const filteredBudgets =
    activeEntityIds.length === 0
      ? []
      : budgets.filter((b) => activeEntityIds.includes(b.entity_id));

  const selectedBudget = filteredBudgets.find(
    (b) => b.id === selectedBudgetId
  );

  return (
    <div className="app-container fade-in">
      <div className="app-header">
        <h1>📊 Perbandingan Budget</h1>
      </div>

      {/* Loading */}
      {loading && <p>Sedang memuat data...</p>}

      {/* KONDISI 1: tidak ada entitas dicentang */}
      {activeEntityIds.length === 0 && (
        <div className="card mb-3 text-center">
          <p>Tidak ada entitas yang dicentang</p>
        </div>
      )}

      {/* KONDISI 2: entitas dicentang tapi tidak ada budget */}
      {activeEntityIds.length > 0 && filteredBudgets.length === 0 && (
        <div className="card mb-3 text-center">
          <p>Belum ada budget yang dibuat untuk entitas terpilih</p>
        </div>
      )}

      {/* Kondisi 3: Ada budget dari entitas yang dicentang */}
      {!loading && filteredBudgets.length > 0 && (
        <div className="card mb-3">
          <div className="stats-grid">
            {filteredBudgets.map((budget) => (
              <div
                key={budget.id}
                onClick={() => setSelectedBudgetId(budget.id)}
                className={`budget-item ${
                  selectedBudgetId === budget.id ? "active" : ""
                }`}
              >
                <p>{budget.entity?.entity_name}</p>
                <p>
                  {budget.department} | {budget.period}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedBudget && (
        <BudgetComparison
          budgetId={selectedBudget.id}
          totalBudget={selectedBudget.total_budget}
        />
      )}
    </div>
  );
};
