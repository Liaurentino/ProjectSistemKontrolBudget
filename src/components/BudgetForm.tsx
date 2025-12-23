import React, { useState } from 'react';
import { insertBudget } from '../lib/supabase';

interface Category {
  id: string;
  name: string;
  percentage: number;
  estimatedAmount: number;
}

interface BudgetFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const predefinedCategories = [
  { name: 'Operasional', defaultPercentage: 40 },
  { name: 'Gaji', defaultPercentage: 35 },
  { name: 'Marketing', defaultPercentage: 15 },
  { name: 'Maintenance', defaultPercentage: 10 },
];

export const BudgetForm: React.FC<BudgetFormProps> = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    entity: '',
    department: '',
    totalBudget: 0,
    period: '',
    description: '',
  });

  const [categories, setCategories] = useState<Category[]>(
    predefinedCategories.map((cat) => ({
      id: Math.random().toString(),
      name: cat.name,
      percentage: cat.defaultPercentage,
      estimatedAmount: 0,
    }))
  );

  const [loading, setLoading] = useState(false);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'totalBudget' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleCategoryChange = (id: string, newPercentage: number) => {
    const updated = categories.map((cat) =>
      cat.id === id ? { ...cat, percentage: newPercentage } : cat
    );
    setCategories(updated);
  };

  const calculateEstimates = () => {
    return categories.map((cat) => ({
      ...cat,
      estimatedAmount: (cat.percentage / 100) * formData.totalBudget,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const totalPercentage = categories.reduce((sum, cat) => sum + cat.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      alert('Total persentase kategori harus 100%!');
      return;
    }

    if (!formData.entity || !formData.department || formData.totalBudget <= 0 || !formData.period) {
      alert('Mohon lengkapi semua field yang diperlukan!');
      return;
    }

    setLoading(true);
    try {
      const updatedCategories = calculateEstimates();

      const { error } = await insertBudget({
        entity: formData.entity,
        department: formData.department,
        total_budget: formData.totalBudget,
        period: formData.period,
        description: formData.description,
        categories_data: updatedCategories,
      });

      if (error) throw error;

      alert('Budget berhasil disimpan!');
      setFormData({ entity: '', department: '', totalBudget: 0, period: '', description: '' });
      setCategories(
        predefinedCategories.map((cat) => ({
          id: Math.random().toString(),
          name: cat.name,
          percentage: cat.defaultPercentage,
          estimatedAmount: 0,
        }))
      );
      onSuccess();
    } catch (error) {
      console.error('Error saving budget:', error);
      alert('Gagal menyimpan budget');
    } finally {
      setLoading(false);
    }
  };

  const totalPercentage = categories.reduce((sum, cat) => sum + cat.percentage, 0);
  const isValidPercentage = Math.abs(totalPercentage - 100) < 0.01;

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Tambah Budget Baru</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Entitas</label>
          <select
            name="entity"
            value={formData.entity}
            onChange={(e) => setFormData({ ...formData, entity: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Pilih Entitas</option>
            <option value="PT Maju Jaya">PT Maju Jaya</option>
            <option value="PT Sukses Bersama">PT Sukses Bersama</option>
            <option value="PT Digital Indonesia">PT Digital Indonesia</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Department</label>
          <input
            type="text"
            name="department"
            placeholder="Contoh: IT, Marketing, HR"
            value={formData.department}
            onChange={handleFormChange}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Total Budget (IDR)</label>
          <input
            type="number"
            name="totalBudget"
            placeholder="0"
            value={formData.totalBudget || ''}
            onChange={handleFormChange}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Periode</label>
          <input
            type="text"
            name="period"
            placeholder="Contoh: 2024-01"
            value={formData.period}
            onChange={handleFormChange}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Deskripsi</label>
        <textarea
          name="description"
          placeholder="Deskripsi budget (opsional)"
          value={formData.description}
          onChange={handleFormChange}
          rows={3}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="mb-8 bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Alokasi Kategori</h3>
        <div className="space-y-4">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-2">{cat.name}</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={cat.percentage}
                    onChange={(e) => handleCategoryChange(cat.id, parseFloat(e.target.value) || 0)}
                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-gray-700 w-8">%</span>
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Estimasi</label>
                <div className="p-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700">
                  Rp {(cat.percentage / 100 * formData.totalBudget).toLocaleString('id-ID')}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-300">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-800">Total Persentase:</span>
            <span className={`font-bold text-lg ${isValidPercentage ? 'text-green-600' : 'text-red-600'}`}>
              {totalPercentage.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onCancel}
          className="flex-1 px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-semibold"
        >
          Batal
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isValidPercentage || loading}
          className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Menyimpan...' : 'Simpan Budget'}
        </button>
      </div>
    </div>
  );
};