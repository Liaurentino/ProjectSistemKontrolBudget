import React, { useState, useEffect } from 'react';
import { insertBudget, getEntities } from '../lib/supabase';

interface Category {
  id: string;
  name: string;
  estimatedAmount: number;
}

interface BudgetFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const predefinedCategories = [
  { name: 'Operasional' },
  { name: 'Gaji' },
  { name: 'Marketing' },
  { name: 'Maintenance' },
];

export const BudgetForm: React.FC<BudgetFormProps> = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    entity_id: '',
    department: '',
    totalBudget: 0,
    period: '',
    description: '',
  });

  const [categories] = useState<Category[]>(
    predefinedCategories.map((cat) => ({
      id: Math.random().toString(),
      name: cat.name,
      estimatedAmount: 0,
    }))
  );

  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEntities, setLoadingEntities] = useState(false);

  useEffect(() => {
    const fetchEntities = async () => {
      setLoadingEntities(true);
      try {
        const { data, error } = await getEntities();
        if (error) throw error;
        setEntities(data || []);
      } catch (error) {
        console.error('Error fetching entities:', error);
        alert('Gagal memuat daftar entitas');
      } finally {
        setLoadingEntities(false);
      }
    };

    fetchEntities();
  }, []);

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'totalBudget' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.entity_id ||
      !formData.department ||
      formData.totalBudget <= 0 ||
      !formData.period
    ) {
      alert('Mohon lengkapi semua field yang diperlukan!');
      return;
    }

    setLoading(true);
    try {
      const { error } = await insertBudget({
        entity_id: formData.entity_id,
        department: formData.department,
        total_budget: formData.totalBudget,
        period: formData.period,
        description: formData.description,
        categories_data: categories,
      });

      if (error) throw error;

      onSuccess();
    } catch (error) {
      console.error('Error:', error);
      alert('Gagal menyimpan budget');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="budget-form" onSubmit={handleSubmit}>
      <h2 className="budget-form-title">Tambah Budget Baru</h2>

      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Entitas</label>
          <select
            name="entity_id"
            value={formData.entity_id}
            onChange={(e) =>
              setFormData({ ...formData, entity_id: e.target.value })
            }
            className="form-select"
            disabled={loadingEntities}
          >
            <option value="">
              {loadingEntities ? 'Memuat...' : 'Pilih Entitas'}
            </option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.entity_name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Department</label>
          <input
            type="text"
            name="department"
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
            value={formData.period}
            onChange={handleFormChange}
            className="form-input"
          />
        </div>
      </div>

      <div className="form-group mt-3">
        <label className="form-label">Deskripsi</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleFormChange}
          className="form-textarea"
        />
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Batal
        </button>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Menyimpan...' : 'Simpan Budget'}
        </button>
      </div>
    </form>
  );
};
