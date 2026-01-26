import React, { useState, useEffect } from 'react';
import { useEntity } from '../../contexts/EntityContext';
import {
  createBudget,
  updateBudget,
  addBudgetItem,
  deleteBudgetItem,
  getAvailableAccountsForBudget,
  type Budget,
  type BudgetItem,
  type Account,
} from '../../lib/accurate';
import {
  getAdaptiveFontSize,
  formatCurrency,
  calculateTotalAllocated,
  calculateTotalRealisasi,
} from '../../services/budgetHelpers';
import styles from './BudgetForm.module.css';

interface BudgetFormProps {
  mode: 'create' | 'edit';
  budget?: Budget;
  items?: BudgetItem[];
  onSuccess: () => void;
  onCancel: () => void;
}

export const BudgetForm: React.FC<BudgetFormProps> = ({
  mode,
  budget,
  items = [],
  onSuccess,
  onCancel,
}) => {
  const { activeEntity } = useEntity();

  // Form state
  const [name, setName] = useState(budget?.name || '');
  const [period, setPeriod] = useState(budget?.period || '');
  const [description, setDescription] = useState(budget?.description || '');

  // Items state
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(items);
  const [availableAccounts, setAvailableAccounts] = useState<Account[]>([]);

  // New item state
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [itemAmount, setItemAmount] = useState<number | ''>(''); // Budget (manual input)
  const [realisasiSnapshot, setRealisasiSnapshot] = useState<number>(0); // Realisasi (auto-fill from COA)
  const [itemDescription, setItemDescription] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);

  // Dropdown filter state
  const [accountFilter, setAccountFilter] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Load available accounts
  useEffect(() => {
    if (activeEntity?.id) {
      loadAvailableAccounts();
    }
  }, [activeEntity, budget?.id, budgetItems]);

  const loadAvailableAccounts = async () => {
    if (!activeEntity) return;

    const { data, error } = await getAvailableAccountsForBudget(
      activeEntity.id,
      budget?.id
    );

    if (error) {
      console.error('Failed to load accounts:', error);
    } else {
      setAvailableAccounts(data || []);
    }
  };

  const totalAllocated = calculateTotalAllocated(budgetItems);
  const totalBudget = totalAllocated;
  const totalRealisasi = calculateTotalRealisasi(budgetItems);

  useEffect(() => {
    const newWarnings: string[] = [];
    if (typeof itemAmount === 'number' && itemAmount > 0 && itemAmount % 1000 !== 0) {
      newWarnings.push('Jumlah budget: Disarankan gunakan angka bulat ribuan (kelipatan 1.000)');
    }
    setWarnings(newWarnings);
  }, [itemAmount]);

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    if (!accountId) {
      setItemAmount(''); // Budget kosong (user input manual)
      setRealisasiSnapshot(0); // Reset realisasi
      return;
    }
    const account = availableAccounts.find(a => a.id === accountId);
    if (account) {
      setItemAmount(''); // Budget kosong (user input manual dari 0)
      setRealisasiSnapshot(account.balance || 0); // Realisasi = snapshot dari COA balance
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeEntity) {
      setError('Tidak ada entitas aktif');
      return;
    }

    if (!name.trim()) {
      setError('Nama budget harus diisi');
      return;
    }

    if (!period) {
      setError('Periode harus diisi');
      return;
    }

    if (budgetItems.length === 0) {
      setError('Tambahkan minimal 1 akun ke budget');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const calculatedTotalBudget = calculateTotalAllocated(budgetItems);

      if (mode === 'create') {
        const { data: newBudget, error: budgetError } = await createBudget({
          entity_id: activeEntity.id,
          name: name.trim(),
          period,
          total_budget: calculatedTotalBudget,
          description: description.trim(),
        });

        if (budgetError) throw budgetError;

        for (const item of budgetItems) {
          await addBudgetItem({
            budget_id: newBudget!.id,
            account_id: item.account_id,
            accurate_id: item.accurate_id,
            account_code: item.account_code,
            account_name: item.account_name,
            account_type: item.account_type,
            allocated_amount: item.allocated_amount,
            realisasi_snapshot: item.realisasi_snapshot || 0, // Include realisasi snapshot
            description: item.description,
          });
        }
      } else {
        await updateBudget(budget!.id, {
          name: name.trim(),
          period,
          total_budget: calculatedTotalBudget,
          description: description.trim(),
        });
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan budget');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    if (!selectedAccountId) {
      setError('Pilih akun terlebih dahulu');
      return;
    }

    if (itemAmount === '' || itemAmount <= 0) {
      setError('Jumlah budget harus diisi dan lebih dari 0');
      return;
    }

    const selectedAccount = availableAccounts.find(a => a.id === selectedAccountId);
    if (!selectedAccount) return;

    const isDuplicate = budgetItems.some(
      (item) => item.account_code === selectedAccount.account_code
    );

    if (isDuplicate) {
      setError(`Akun ${selectedAccount.account_code} sudah ada di budget ini`);
      return;
    }

    const newItem: BudgetItem = {
      id: '',
      budget_id: budget?.id || '',
      account_id: selectedAccount.id,
      accurate_id: selectedAccount.accurate_id,
      account_code: selectedAccount.account_code,
      account_name: selectedAccount.account_name,
      account_type: selectedAccount.account_type,
      allocated_amount: Number(itemAmount), // Budget (manual input)
      realisasi_snapshot: realisasiSnapshot, // Realisasi (snapshot from COA)
      description: itemDescription.trim(),
    };

    setBudgetItems([...budgetItems, newItem]);
    setSelectedAccountId('');
    setItemAmount('');
    setRealisasiSnapshot(0);
    setItemDescription('');
    setAccountFilter('');
    setShowAddItem(false);
    setError(null);
  };

  const handleAddItemToExistingBudget = async () => {
    if (!budget?.id || !selectedAccountId) return;

    if (itemAmount === '' || itemAmount <= 0) {
      setError('Jumlah budget harus diisi dan lebih dari 0');
      return;
    }

    const selectedAccount = availableAccounts.find(a => a.id === selectedAccountId);
    if (!selectedAccount) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: addError } = await addBudgetItem({
        budget_id: budget.id,
        account_id: selectedAccount.id,
        accurate_id: selectedAccount.accurate_id,
        account_code: selectedAccount.account_code,
        account_name: selectedAccount.account_name,
        account_type: selectedAccount.account_type,
        allocated_amount: Number(itemAmount), // Budget (manual input)
        realisasi_snapshot: realisasiSnapshot, // Realisasi (snapshot from COA)
        description: itemDescription.trim(),
      });

      if (addError) throw addError;

      setBudgetItems([...budgetItems, data!]);
      setSelectedAccountId('');
      setItemAmount('');
      setRealisasiSnapshot(0);
      setItemDescription('');
      setAccountFilter('');
      setShowAddItem(false);
    } catch (err: any) {
      setError(err.message || 'Gagal menambah item');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string, accountCode: string) => {
    if (!confirm(`Hapus item ${accountCode}?`)) return;

    if (mode === 'edit' && budget?.id) {
      setLoading(true);
      try {
        await deleteBudgetItem(itemId);
        setBudgetItems(budgetItems.filter((item) => item.id !== itemId));
      } catch (err: any) {
        setError(err.message || 'Gagal menghapus item');
      } finally {
        setLoading(false);
      }
    } else {
      setBudgetItems(budgetItems.filter((item) => item.account_code !== accountCode));
    }
  };

  const filteredAccounts = availableAccounts.filter(
    (acc) =>
      acc.account_code.toLowerCase().includes(accountFilter.toLowerCase()) ||
      acc.account_name.toLowerCase().includes(accountFilter.toLowerCase())
  );

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.headerTitle}>
          {mode === 'create' ? '📝 Buat Budget Baru' : 'Edit Budget'}
        </h2>
        <p className={styles.headerSubtitle}>
          {mode === 'create'
            ? 'Buat budget baru dan alokasikan ke akun-akun perkiraan'
            : 'Edit informasi budget dan kelola alokasi akun'}
        </p>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Error Alert */}
        {error && <div className={styles.errorAlert}>⚠️ {error}</div>}

        {/* Warning Alert */}
        {warnings.length > 0 && (
          <div className={styles.warningAlert}>
            <div className={styles.warningAlertTitle}>⚠️ Peringatan:</div>
            {warnings.map((warning, idx) => (
              <div key={idx}>• {warning}</div>
            ))}
          </div>
        )}

        {/* Section: Informasi Budget */}
        <div>
          <h3 className={styles.sectionTitle}>Informasi Budget</h3>

          <div className={styles.formGrid}>
            {/* Nama Budget */}
            <div>
              <label className={styles.label}>
                Nama Budget <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={150}
                disabled={loading}
                placeholder="Contoh: Budget Operasional Q1 2026"
                className={styles.input}
              />
              <div className={styles.charCount}>{name.length}/150 karakter</div>
            </div>

            {/* Periode */}
            <div>
              <label className={styles.label}>
                Periode <span className={styles.required}>*</span>
              </label>
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                required
                disabled={loading}
                className={styles.monthInput}
              />
            </div>
          </div>

    
        {/* Section: Alokasi Budget */}
        <div>
          <div className={styles.allocationHeader}>
            <h3 className={styles.sectionTitle}>
              Alokasi Budget ke Akun ({budgetItems.length})
            </h3>
            <button
              type="button"
              onClick={() => setShowAddItem(!showAddItem)}
              disabled={loading}
              className={`${styles.addButton} ${showAddItem ? styles.addButtonClose : ''}`}
            >
              {showAddItem ? '✕ Tutup' : '+ Tambah Akun'}
            </button>
          </div>

          {/* Add Item Form */}
          {showAddItem && (
            <div className={styles.addItemForm}>
              <h4 className={styles.addItemTitle}>Tambah Akun ke Budget</h4>

              <div>
                <label className={styles.label}>
                  Cari Akun <span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  value={accountFilter}
                  onChange={(e) => setAccountFilter(e.target.value)}
                  placeholder="🔍 Ketik kode atau nama akun untuk mencari..."
                  className={styles.searchInput}
                />
              </div>

              <div>
                <label className={styles.label}>
                  Pilih dari daftar ({filteredAccounts.length} akun tersedia)
                </label>
                {filteredAccounts.length === 0 ? (
                  <div className={styles.noItems}>
                    {accountFilter
                      ? `Tidak ada akun yang cocok dengan "${accountFilter}"`
                      : 'Semua akun sudah dialokasikan'}
                  </div>
                ) : (
                  <div className={styles.accountListContainer}>
                    {filteredAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        onClick={() => handleAccountSelect(acc.id)}
                        className={`${styles.accountItem} ${
                          selectedAccountId === acc.id ? styles.accountItemSelected : ''
                        }`}
                      >
                        <div className={styles.accountRow}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <code className={styles.accountCode}>{acc.account_code}</code>
                              <span className={styles.accountName}>{acc.account_name}</span>
                            </div>
                            <div className={styles.accountType}>
                              {acc.account_type_name || acc.account_type}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', marginLeft: '16px', flexShrink: 0 }}>
                            <div className={styles.balanceValue}>Rp {formatCurrency(acc.balance || 0)}</div>
                            <div className={styles.balanceLabel}>Balance (Realisasi)</div>
                          </div>
                        </div>
                        {selectedAccountId === acc.id && (
                          <div className={styles.selectedIndicator}>✓ Akun dipilih</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedAccountId && (
                <>
                  {/* NEW: Show realisasi snapshot */}
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: '#f0f9ff', 
                    borderRadius: '8px',
                    border: '1px solid #bae6fd',
                    marginBottom: '16px'
                  }}>
                    <div style={{ fontSize: '14px', color: '#0369a1', marginBottom: '4px' }}>
                      📊 Realisasi (Balance COA saat ini):
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#0c4a6e' }}>
                      Rp {formatCurrency(realisasiSnapshot)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#075985', marginTop: '4px' }}>
                      Nilai ini akan tersimpan sebagai snapshot dan tidak akan berubah
                    </div>
                  </div>

                  <div className={styles.amountGrid}>
                    <div>
                      <label className={styles.label}>
                        Budget (Target) <span className={styles.required}>*</span>
                      </label>
                      <input
                        type="number"
                        value={itemAmount}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || value.replace(/\D/g, '').length <= 15) {
                            setItemAmount(value === '' ? '' : Number(value));
                          }
                        }}
                        onKeyPress={(e) => {
                          const currentValue = (itemAmount || '').toString().replace(/\D/g, '');
                          if (currentValue.length >= 15 && e.key !== 'Backspace' && e.key !== 'Delete') {
                            e.preventDefault();
                          }
                        }}
                        min={0}
                        max={999_999_999_999_999}
                        step={1}
                        disabled={loading}
                        placeholder="Masukkan nominal budget (max 15 digit)"
                        className={styles.input}
                      />
                      <div className={styles.charCount}>
                        Input manual • Max 15 digit
                      </div>
                    </div>

                    <div>
                      <label className={styles.label}>Catatan</label>
                      <input
                        type="text"
                        value={itemDescription}
                        onChange={(e) => setItemDescription(e.target.value)}
                        maxLength={200}
                        disabled={loading}
                        placeholder="Catatan (opsional)..."
                        className={styles.input}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={mode === 'edit' && budget?.id ? handleAddItemToExistingBudget : handleAddItem}
                    disabled={!selectedAccountId || itemAmount === '' || itemAmount <= 0 || loading}
                    className={styles.addAccountButton}
                  >
                    ✓ Tambahkan ke Budget
                  </button>
                </>
              )}
            </div>
          )}

          {/* Items Table */}
          {budgetItems.length === 0 ? (
            <div className={styles.noItems}>
              Belum ada alokasi akun. Klik "Tambah Akun" untuk mulai.
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.tableHeader}>
                    <th className={styles.tableHeaderCell}>Kode Akun</th>
                    <th className={styles.tableHeaderCell}>Nama Akun</th>
                    <th className={styles.tableHeaderCell}>Tipe</th>
                    <th className={styles.tableHeaderCell}>Budget</th>
                    <th className={styles.tableHeaderCell}>Realisasi</th>
                    <th className={styles.tableHeaderCell}>Catatan</th>
                    <th className={`${styles.tableHeaderCell} ${styles.tableCellCenter}`}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetItems.map((item, index) => (
                    <tr key={item.id || index}>
                      <td className={styles.tableCell}>
                        <code className={styles.codeBadge}>{item.account_code}</code>
                      </td>
                      <td className={styles.tableCell}>
                        <div
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '250px',
                          }}
                        >
                          {item.account_name}
                        </div>
                      </td>
                      <td className={styles.tableCell}>
                        <span className={styles.typeBadge}>{item.account_type}</span>
                      </td>
                      <td className={styles.tableCell}>
                        <strong
                          style={{
                            fontSize: `${getAdaptiveFontSize(item.allocated_amount)}px`,
                          }}
                        >
                          Rp {formatCurrency(item.allocated_amount)}
                        </strong>
                      </td>
                      <td className={styles.tableCell}>
                        <span
                          style={{
                            fontSize: `${getAdaptiveFontSize(item.realisasi_snapshot || 0)}px`,
                            color: '#0369a1',
                          }}
                        >
                          Rp {formatCurrency(item.realisasi_snapshot || 0)}
                        </span>
                      </td>
                      <td className={styles.tableCell}>
                        <div
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '150px',
                          }}
                        >
                          {item.description || '-'}
                        </div>
                      </td>
                      <td className={`${styles.tableCell} ${styles.tableCellCenter}`}>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id, item.account_code)}
                          disabled={loading}
                          className={styles.deleteButton}
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

        {/* Budget Summary */}
        <div className={styles.summaryBox}>
          <div className={styles.summaryContent}>
            <div>
              <div className={styles.totalLabel}>Total Budget</div>
              <div
                className={styles.totalAmount}
                style={{ fontSize: `${getAdaptiveFontSize(totalBudget)}px` }}
              >
                Rp {formatCurrency(totalBudget)}
              </div>
              
              {totalRealisasi > 0 && (
                <div className={styles.totalHint} style={{ marginTop: '8px' }}>
                  <span>📊</span>
                  <span>Total Realisasi: Rp {formatCurrency(totalRealisasi)}</span>
                </div>
              )}
              
              <div className={styles.totalHint}>
                <span>💡</span>
                <span>Dihitung otomatis dari {budgetItems.length} akun yang dialokasikan</span>
              </div>
            </div>

            {budgetItems.length > 0 && (
              <div className={styles.accountCountBadge}>
                <div className={styles.accountCountNumber}>{budgetItems.length}</div>
                <div className={styles.accountCountLabel}>Akun</div>
              </div>
            )}
          </div>
        </div>

         {/* Deskripsi */}
        <div className={styles.fullWidth}>
            <label className={styles.label}>Deskripsi</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              disabled={loading}
              placeholder="Deskripsi budget (opsional)..."
              className={styles.textarea}
            />
            <div className={styles.charCount}>{description.length}/500 karakter</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className={styles.cancelButton}
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={loading || !name.trim() || !period || totalBudget <= 0}
            className={styles.submitButton}
          >
            {loading ? 'Menyimpan...' : mode === 'create' ? 'Simpan Budget' : 'Update Budget'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BudgetForm;