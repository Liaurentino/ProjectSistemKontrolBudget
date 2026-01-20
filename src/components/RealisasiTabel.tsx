import React, { useEffect, useState } from "react";
import {
  getRealisasiByBudget,
  insertRealisasi,
  deleteRealisasi,
} from "../lib/supabase";

interface Realisasi {
  id: string;
  budget_id: string;
  category?: string;
  amount: number;
  description?: string;
  date: string;
  created_at: string;
}

interface RealisasiTableProps {
  budgetId: string;
  categories?: any[];
  budgets: any[];
  entities: any[];              
  activeEntityIds: string[];   
  selectedBudgetId: string | null;
  onChangeBudget: (id: string) => void;
}

export const RealisasiTable: React.FC<RealisasiTableProps> = ({
  budgetId,
  categories = [],
  budgets = [],
  entities = [],
  activeEntityIds = [],
  selectedBudgetId,
  onChangeBudget,
}) => {
  const [realisasi, setRealisasi] = useState<Realisasi[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    category: "",
    amount: 0,
    description: "",
    date: new Date().toISOString().split("T")[0],
  });

  const fetchRealisasi = async () => {
    setLoading(true);
    try {
      const { data } = await getRealisasiByBudget(budgetId);
      setRealisasi(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (budgetId) fetchRealisasi();
  }, [budgetId]);

  const handleAddRealisasi = async () => {
    if (!formData.amount || formData.amount <= 0) {
      alert("Jumlah harus lebih besar dari 0");
      return;
    }

    setLoading(true);
    try {
      await insertRealisasi({
        budget_id: budgetId,
        category: formData.category,
        amount: formData.amount,
        description: formData.description,
        date: formData.date,
      });

      setFormData({
        category: "",
        amount: 0,
        description: "",
        date: new Date().toISOString().split("T")[0],
      });

      setShowForm(false);
      fetchRealisasi();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus realisasi ini?")) return;
    await deleteRealisasi(id);
    fetchRealisasi();
  };

  // =========================
  // DROPDOWN ENTITAS
  // =========================

  // hanya entitas aktif yang punya budget
  const visibleEntities = entities.filter((ent: any) =>
    activeEntityIds.includes(ent.id)
  );

  // entity yang sedang terpilih (berdasarkan budget terpilih)
  const selectedEntityId =
    budgets.find((b) => b.id === selectedBudgetId)?.entity?.id || "";

  const handleSelectEntity = (entityId: string) => {
    // cari budget milik entitas ini
    const found = budgets.find((b) => b.entity?.id === entityId);

    if (found) onChangeBudget(found.id);
  };

  return (
    <div className="card fade-in">
      <div className="card-header">
        <h3 className="card-title">Realisasi Pengeluaran</h3>
      </div>

      {/* DROPDOWN ENTITAS */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        <select
          className="form-select"
          value={selectedEntityId}
          onChange={(e) => handleSelectEntity(e.target.value)}
        >
          <option value="">Pilih entitas</option>

          {visibleEntities.map((entity: any) => (
            <option key={entity.id} value={entity.id}>
              {entity.entity_name}
            </option>
          ))}
        </select>

        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            + Tambah Realisasi
          </button>
        )}
      </div>

      {showForm && (
        <div className="card mb-4 fade-in">
          <h4 className="mb-3">Tambah Realisasi Baru</h4>

          <div className="stats-grid">
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select
                className="form-select"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
              >
                <option value="">Pilih Kategori</option>

                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Jumlah (IDR)</label>
              <input
                type="number"
                className="form-input"
                value={formData.amount || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="0"
              />
            </div>
          </div>

          <div className="stats-grid">
            <div className="form-group">
              <label className="form-label">Tanggal</label>
              <input
                type="date"
                className="form-input"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Deskripsi</label>
              <input
                type="text"
                className="form-input"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Contoh: Beli ATK"
              />
            </div>
          </div>

          <div className="modal-footer" style={{ marginTop: "1rem" }}>
            <button
              onClick={() => setShowForm(false)}
              className="btn btn-outline"
            >
              Batal
            </button>

            <button onClick={handleAddRealisasi} className="btn btn-primary">
              Simpan
            </button>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Kategori</th>
              <th>Deskripsi</th>
              <th style={{ textAlign: "right" }}>Jumlah</th>
              <th style={{ textAlign: "center" }}>Aksi</th>
            </tr>
          </thead>

          <tbody>
            {realisasi.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center">
                  Belum ada data pengeluaran
                </td>
              </tr>
            ) : (
              realisasi.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.date).toLocaleDateString("id-ID")}</td>
                  <td>{r.category || "-"}</td>
                  <td>{r.description || "-"}</td>
                  <td style={{ textAlign: "right" }}>
                    Rp {r.amount.toLocaleString("id-ID")}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="btn btn-danger btn-sm"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};