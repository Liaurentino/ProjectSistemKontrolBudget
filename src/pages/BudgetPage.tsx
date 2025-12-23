import React, { useEffect, useState } from 'react';
import { BudgetForm } from '../components/BudgetForm';
import { deleteBudget, getBudgets } from '../lib/supabase';

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

export const BudgetPage: React.FC = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const { data, error } = await getBudgets();
      if (error) throw error;
      setBudgets(data || []);
    } catch (error) {
      console.error('Error fetching budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus budget ini?')) return;

    try {
      const { error } = await deleteBudget(id);
      if (error) throw error;
      await fetchBudgets();
    } catch (error) {
      console.error('Error deleting budget:', error);
      alert('Gagal menghapus budget');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
              📊
            </div>
            <h1 className="text-3xl font-bold text-gray-800">Budget Management</h1>
          </div>
          <p className="text-gray-600">Kelola budget dan alokasi kategori untuk perusahaan Anda</p>
        </div>

        {/* Form Section */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="mb-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            + Tambah Budget
          </button>
        )}

        {showForm && (
          <div className="mb-8">
            <BudgetForm
              onSuccess={() => {
                setShowForm(false);
                fetchBudgets();
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {/* Budget List */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Daftar Budget</h2>
          {loading ? (
            <div className="text-center py-8 text-gray-600">Loading...</div>
          ) : budgets.length === 0 ? (
            <div className="bg-white rounded-lg shadow-lg p-8 text-center text-gray-600">
              Belum ada budget. Silakan tambahkan budget baru.
            </div>
          ) : (
            <div className="space-y-6">
              {budgets.map((budget) => (
                <div key={budget.id} className="bg-white rounded-lg shadow-lg p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div>
                      <p className="text-sm text-gray-600">Entitas</p>
                      <p className="font-semibold text-gray-800">{budget.entity}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Department</p>
                      <p className="font-semibold text-gray-800">{budget.department}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Periode</p>
                      <p className="font-semibold text-gray-800">{budget.period}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Budget</p>
                      <p className="font-bold text-blue-600">Rp {budget.total_budget.toLocaleString('id-ID')}</p>
                    </div>
                  </div>

                  {/* Categories Table */}
                  <div className="mb-6 overflow-x-auto">
                    <h4 className="text-sm font-bold text-gray-800 mb-3">Alokasi Kategori</h4>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 border-b">
                          <th className="p-3 text-left font-semibold text-gray-700">Kategori</th>
                          <th className="p-3 text-right font-semibold text-gray-700">Persentase</th>
                          <th className="p-3 text-right font-semibold text-gray-700">Estimasi Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budget.categories_data.map((cat, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="p-3 text-gray-800">{cat.name}</td>
                            <td className="p-3 text-right text-gray-800 font-semibold">{cat.percentage.toFixed(1)}%</td>
                            <td className="p-3 text-right text-blue-600 font-semibold">
                              Rp {cat.estimatedAmount?.toLocaleString('id-ID') || '0'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {budget.description && (
                    <div className="mb-4 p-3 bg-gray-50 rounded text-sm text-gray-700">
                      <strong>Deskripsi:</strong> {budget.description}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4 border-t">
                    <button
                      onClick={() => setSelectedBudgetId(budget.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition font-semibold text-sm"
                    >
                      Lihat Realisasi
                    </button>
                    <button
                      onClick={() => handleDelete(budget.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition font-semibold text-sm"
                    >
                      Hapus
                    </button>
                  </div>

                  {selectedBudgetId === budget.id && (
                    <div className="mt-6 pt-6 border-t">
                      {/* Realisasi component will be integrated here in RealisasiPage */}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
