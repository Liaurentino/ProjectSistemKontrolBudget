import React, { useEffect, useState } from 'react';
import { getBudgets } from '../lib/supabase';
import { RealisasiTable } from '../components/RealisasiTabel';

interface Budget {
  id: string;
  entity: string;
  department: string;
  total_budget: number;
  period: string;
  description?: string;
  categories_data: any[];
  created_at: string;
}

export const RealisasiPage: React.FC = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
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
      console.error('Error fetching budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  const selectedBudget = budgets.find((b) => b.id === selectedBudgetId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold">
              📈
            </div>
            <h1 className="text-3xl font-bold text-gray-800">Realisasi Pengeluaran</h1>
          </div>
          <p className="text-gray-600">Tracking realisasi pengeluaran vs budget yang direncanakan</p>
        </div>

        {/* Budget Selector */}
        {!loading && budgets.length > 0 && (
          <div className="mb-8 bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Pilih Budget</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {budgets.map((budget) => (
                <button
                  key={budget.id}
                  onClick={() => setSelectedBudgetId(budget.id)}
                  className={`p-4 rounded-lg border-2 transition text-left ${
                    selectedBudgetId === budget.id
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-300 hover:border-green-400'
                  }`}
                >
                  <p className="font-bold text-gray-800">{budget.entity}</p>
                  <p className="text-sm text-gray-600">{budget.department}</p>
                  <p className="text-sm text-gray-600">{budget.period}</p>
                  <p className="text-sm font-semibold text-green-600">
                    Rp {budget.total_budget.toLocaleString('id-ID')}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Realisasi Section */}
        {loading ? (
          <div className="text-center py-8 text-gray-600">Loading...</div>
        ) : selectedBudget ? (
          <div className="space-y-6">
            {/* Budget Info */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                {selectedBudget.entity} - {selectedBudget.department}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Total Budget</p>
                  <p className="text-2xl font-bold text-blue-600">
                    Rp {selectedBudget.total_budget.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Periode</p>
                  <p className="text-2xl font-bold text-gray-800">{selectedBudget.period}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Total Kategori</p>
                  <p className="text-2xl font-bold text-gray-800">{selectedBudget.categories_data.length}</p>
                </div>
              </div>

              {selectedBudget.description && (
                <div className="mt-4 p-3 bg-gray-100 rounded text-sm text-gray-700">
                  <strong>Deskripsi:</strong> {selectedBudget.description}
                </div>
              )}
            </div>

            {/* Realisasi Table Component */}
            <RealisasiTable
              budgetId={selectedBudget.id}
              categories={selectedBudget.categories_data}
              totalBudget={selectedBudget.total_budget}
            />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center text-gray-600">
            Belum ada budget. Silakan buat budget terlebih dahulu di halaman Budget Management.
          </div>
        )}
      </div>
    </div>
  );
};
