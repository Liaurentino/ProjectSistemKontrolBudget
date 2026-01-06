import React, { useEffect, useState } from "react";
import { getLocalAccounts, subscribeAccounts } from "../lib/accurate";

interface LocalAccount {
  id?: string;
  accurate_id: string;
  account_name: string;
  account_code: string;
  account_type: string;
  is_active?: boolean;
}

const CoaPage: React.FC = () => {
  const [accounts, setAccounts] = useState<LocalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAccounts() {
    try {
      setError(null);
      setLoading(true);

      const { data, error } = await getLocalAccounts();
      if (error) throw error;

      setAccounts(data ?? []);
    } catch (err: any) {
      console.error("Error loading accounts:", err);
      setError(
        err?.message || "Gagal memuat daftar akun. Pastikan webhook sudah aktif."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();

    const channel = subscribeAccounts(() => {
      loadAccounts();
    });

    return () => {
      try {
        channel?.unsubscribe();
      } catch {}
    };
  }, []);

  return (
    <div className="coa-container">
      <div className="header-area">
        <h2 className="page-title">Chart of Accounts</h2>

        <button className="btn-refresh" onClick={loadAccounts} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="loading-area">Memuat data...</div>
      ) : (
        <div className="table-wrapper">
          <table className="coa-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Akun</th>
                <th>Tipe</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    Belum ada data COA. Pastikan webhook Accurate berjalan.
                  </td>
                </tr>
              )}

              {accounts.map((acc) => (
                <tr key={acc.accurate_id}>
                  <td>{acc.account_code}</td>
                  <td>{acc.account_name}</td>
                  <td>{acc.account_type}</td>
                  <td>{acc.is_active !== false ? "Aktif" : "Nonaktif"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CoaPage;
