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

      onSuccess();
    } catch (error) {
      alert('Gagal menyimpan budget');
    } finally {
      setLoading(false);
    }
  };

  const totalPercentage = categories.reduce((sum, cat) => sum + cat.percentage, 0);
  const isValidPercentage = Math.abs(totalPercentage - 100) < 0.01;

  return (
    <form className="budget-form" onSubmit={handleSubmit}>
      <h2 className="budget-form-title">Tambah Budget Baru</h2>

      {/* GRID UTAMA */}
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Entitas</label>
          <select
            name="entity"
            value={formData.entity}
            onChange={(e) => setFormData({ ...formData, entity: e.target.value })}
            className="form-select"
          >
            <option value="">Pilih Entitas</option>
            <option value="PT Maju Jaya">PT Maju Jaya</option>
            <option value="PT Sukses Bersama">PT Sukses Bersama</option>
            <option value="PT Digital Indonesia">PT Digital Indonesia</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Department</label>
          <input
            type="text"
            name="department"
            placeholder="Contoh: IT, Marketing, HR"
            value={formData.department}
            onChange={handleFormChange}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Total Budget (IDR)</label>
          <input
            type="number"
            name="totalBudget"
            value={formData.totalBudget || ''}
            onChange={handleFormChange}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Periode</label>
          <input
            type="text"
            name="period"
            placeholder="Contoh: 2024-01"
            value={formData.period}
            onChange={handleFormChange}
            className="form-input"
          />
        </div>
      </div>

      {/* DESKRIPSI */}
      <div className="form-group mt-3">
        <label className="form-label">Deskripsi</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleFormChange}
          className="form-textarea"
          placeholder="Deskripsi budget (opsional)"
        />
      </div>

      {/* ALOKASI KATEGORI */}
      <div className="category-section">
        <h3>Alokasi Kategori</h3>

        {categories.map((cat) => (
          <div key={cat.id} className="category-row">
            <strong>{cat.name}</strong>

            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={cat.percentage}
              onChange={(e) =>
                handleCategoryChange(cat.id, parseFloat(e.target.value) || 0)
              }
              className="form-input"
            />

            <span>
              Rp {(cat.percentage / 100 * formData.totalBudget).toLocaleString('id-ID')}
            </span>
          </div>
        ))}

        <p className="mt-2">
          <strong>Total Persentase:</strong>{' '}
          <span style={{ color: isValidPercentage ? 'green' : 'red' }}>
            {totalPercentage.toFixed(1)}%
          </span>
        </p>
      </div>

      {/* ACTION */}
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={onCancel}
        >
          Batal
        </button>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!isValidPercentage || loading}
        >
          {loading ? 'Menyimpan...' : 'Simpan Budget'}
        </button>
      </div>
    </form>
  );
};
