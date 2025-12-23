import React, { useEffect, useState } from 'react';
import { getRealisasiByBudget, insertRealisasi, deleteRealisasi } from '../lib/supabase';

interface Realisasi {
  id: string;
  budget_id: string;
  category_id?: string;
  amount: number;
  description?: string;
  date: string;
  created_at: string;
}

interface RealisasiTableProps {
  budgetId: string;
  categories: any[];
  totalBudget: number;
}

export const RealisasiTable: React.FC<RealisasiTableProps> = ({ budgetId, categories, totalBudget }) => {
  const [realisasi, setRealisasi] = useState<Realisasi[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category_id: '',
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const fetchRealisasi = async () => {
    setLoading(true);
    try {
      const { data, error } = await getRealisasiByBudget(budgetId);
      if (error) throw error;
      setRealisasi(data || []);
    } catch (error) {
      console.error('Error fetching realisasi:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealisasi();
  }, [budgetId]);

  const handleAddRealisasi = async () => {
    if (!formData.amount || formData.amount <= 0) {
      alert('Jumlah harus lebih besar dari 0');
      return;
    }

    setLoading(true);
    try {
      const { error } = await insertRealisasi({
        budget_id: budgetId,
        category_id: formData.category_id || undefined,
        amount: formData.amount,
        description: formData.description,
        date: formData.date,
      });

      if (error) throw error;

      setFormData({
        category_id: '',
        amount: 0,
        description: '',
        date: new Date().toISOString().split('T')[0],
      });
      setShowForm(false);
      await fetchRealisasi();
    } catch (error) {
      console.error('Error adding realisasi:', error);
      alert('Gagal menambah realisasi');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus realisasi ini?')) return;

    try {
      const { error } = await deleteRealisasi(id);
      if (error) throw error;
      await fetchRealisasi();
    } catch (error) {
      console.error('Error deleting realisasi:', error);
      alert('Gagal menghapus realisasi');
    }
  };

  const totalRealisasi = realisasi.reduce((sum, r) => sum + r.amount, 0);
  const sisaBudget = totalBudget - totalRealisasi;
  const percentageUsed = (totalRealisasi / totalBudget) * 100;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">Realisasi Pengeluaran</h3>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">Progress Pengeluaran</span>
          <span className="text-sm font-semibold text-gray-700">{percentageUsed.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${percentageUsed > 100 ? 'bg-red-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(percentageUsed, 100)}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-blue-50 p-3 rounded">
            <p className="text-xs text-gray-600">Total Budget</p>
            <p className="text-lg font-bold text-blue-600">Rp {totalBudget.toLocaleString('id-ID')}</p>
          </div>
          <div className="bg-orange-50 p-3 rounded">
            <p className="text-xs text-gray-600">Total Realisasi</p>
            <p className="text-lg font-bold text-orange-600">Rp {totalRealisasi.toLocaleString('id-ID')}</p>
          </div>
          <div className={`p-3 rounded ${sisaBudget >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className="text-xs text-gray-600">Sisa Budget</p>
            <p className={`text-lg font-bold ${sisaBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Rp {sisaBudget.toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      </div>

      {/* Add Realisasi Form */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
        >
          + Tambah Realisasi
        </button>
      )}

      {showForm && (
        <div className="mb-6 bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-bold text-gray-800 mb-4">Tambah Realisasi Baru</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Kategori (Opsional)</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Pilih Kategori</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Jumlah (IDR)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Deskripsi (Opsional)</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Deskripsi pengeluaran"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 px-3 py-1 bg-gray-400 text-white rounded text-sm hover:bg-gray-500 transition"
            >
              Batal
            </button>
            <button
              onClick={handleAddRealisasi}
              disabled={loading}
              className="flex-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              Simpan
            </button>
          </div>
        </div>
      )}

      {/* Realisasi List */}
      {loading && !realisasi.length ? (
        <div className="text-center py-6 text-gray-600">Loading...</div>
      ) : realisasi.length === 0 ? (
        <div className="text-center py-6 text-gray-600">Belum ada realisasi</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="p-2 text-left font-semibold text-gray-700">Tanggal</th>
                <th className="p-2 text-left font-semibold text-gray-700">Deskripsi</th>
                <th className="p-2 text-right font-semibold text-gray-700">Jumlah</th>
                <th className="p-2 text-center font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {realisasi.map((r) => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 text-gray-800">{new Date(r.date).toLocaleDateString('id-ID')}</td>
                  <td className="p-2 text-gray-800">{r.description || '-'}</td>
                  <td className="p-2 text-right text-blue-600 font-semibold">
                    Rp {r.amount.toLocaleString('id-ID')}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-red-600 hover:text-red-800 text-xs font-semibold"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};



