import React, { useEffect, useState } from "react";
import {
  getRealisasiByBudget,
  insertRealisasi,
  deleteRealisasi,
} from "../../lib/supabase";
import styles from "./RealisasiTable.module.css";

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
    setLoading(true);
    try {
      await deleteRealisasi(id);
      fetchRealisasi();
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // DROPDOWN ENTITAS
  // =========================

  const visibleEntities = entities.filter((ent: any) =>
    activeEntityIds.includes(ent.id)
  );

  const selectedEntityId =
    budgets.find((b) => b.id === selectedBudgetId)?.entity?.id || "";

  const handleSelectEntity = (entityId: string) => {
    const found = budgets.find((b) => b.entity?.id === entityId);
    if (found) onChangeBudget(found.id);
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Realisasi Pengeluaran</h3>
      </div>

      {/* DROPDOWN ENTITAS */}
      <div className={styles.controls}>
        <select
          className={styles.formSelect}
          value={selectedEntityId}
          onChange={(e) => handleSelectEntity(e.target.value)}
          disabled={loading}
        >
          <option value="">Pilih entitas</option>
          {visibleEntities.map((entity: any) => (
            <option key={entity.id} value={entity.id}>
              {entity.entity_name}
            </option>
          ))}
        </select>

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className={styles.addButton}
            disabled={loading}
          >
            + Tambah Realisasi
          </button>
        )}
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <h4 className={styles.formCardTitle}>Tambah Realisasi Baru</h4>

          <div className={styles.statsGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Kategori</label>
              <select
                className={styles.formSelectInput}
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                disabled={loading}
              >
                <option value="">Pilih Kategori</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Jumlah (IDR)</label>
              <input
                type="number"
                className={styles.formInput}
                value={formData.amount || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="0"
                disabled={loading}
              />
            </div>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tanggal</label>
              <input
                type="date"
                className={styles.formInput}
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                disabled={loading}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Deskripsi</label>
              <input
                type="text"
                className={styles.formInput}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Contoh: Beli ATK"
                disabled={loading}
              />
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              onClick={() => setShowForm(false)}
              className={styles.cancelButton}
              disabled={loading}
            >
              Batal
            </button>

            <button
              onClick={handleAddRealisasi}
              className={styles.saveButton}
              disabled={loading}
            >
              {loading ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      )}

      {/* LOADING INDICATOR */}
      {loading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner}></div>
          <p className={styles.loadingText}>Memuat data...</p>
        </div>
      )}

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Kategori</th>
              <th>Deskripsi</th>
              <th className={styles.amount}>Jumlah</th>
              <th className={styles.actions}>Aksi</th>
            </tr>
          </thead>

          <tbody>
            {realisasi.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.textCenter}>
                  {loading ? "Memuat..." : "Belum ada data pengeluaran"}
                </td>
              </tr>
            ) : (
              realisasi.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.date).toLocaleDateString("id-ID")}</td>
                  <td>{r.category || "-"}</td>
                  <td>{r.description || "-"}</td>
                  <td className={styles.amount}>
                    Rp {r.amount.toLocaleString("id-ID")}
                  </td>
                  <td className={styles.actions}>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className={styles.deleteButton}
                      disabled={loading}
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

export default RealisasiTable;