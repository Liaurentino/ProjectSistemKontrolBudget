import React, { useState, useEffect } from 'react';
import { useEntity } from '../contexts/EntityContext';
import {
  createBudget,
  updateBudget,
  addBudgetItem,
  updateBudgetItem,
  deleteBudgetItem,
  getAvailableAccountsForBudget,
  validateBudgetAllocation,
  type Budget,
  type BudgetItem,
  type Account,
} from '../lib/accurate';

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
  const [period, setPeriod] = useState(budget?.period || '');
  const [totalBudget, setTotalBudget] = useState(budget?.total_budget || 0);
  const [description, setDescription] = useState(budget?.description || '');

  // Items state
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(items);
  const [availableAccounts, setAvailableAccounts] = useState<Account[]>([]);
  const [searchAccount, setSearchAccount] = useState('');

  // New item state
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [itemAmount, setItemAmount] = useState(0);
  const [itemDescription, setItemDescription] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<any>(null);

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

  // Calculate totals
  const totalAllocated = budgetItems.reduce((sum, item) => sum + item.allocated_amount, 0);
  const remaining = totalBudget - totalAllocated;
  const isOverBudget = totalAllocated > totalBudget;

  // Validate on change
  useEffect(() => {
    if (budget?.id) {
      validateBudget();
    }
  }, [budgetItems, totalBudget]);

  const validateBudget = async () => {
    if (!budget?.id) return;
    const result = await validateBudgetAllocation(budget.id);
    setValidation(result);
  };

  // Handle submit budget
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeEntity) {
      setError('Tidak ada entitas aktif');
      return;
    }

    if (!period) {
      setError('Periode harus diisi');
      return;
    }

    if (totalBudget <= 0) {
      setError('Total budget harus lebih dari 0');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'create') {
        const { data: newBudget, error: budgetError } = await createBudget({
          entity_id: activeEntity.id,
          period,
          total_budget: totalBudget,
          description,
        });

        if (budgetError) throw budgetError;

        // Add items if any
        for (const item of budgetItems) {
          await addBudgetItem({
            budget_id: newBudget!.id,
            account_id: item.account_id,
            accurate_id: item.accurate_id,
            account_code: item.account_code,
            account_name: item.account_name,
            account_type: item.account_type,
            allocated_amount: item.allocated_amount,
            description: item.description,
          });
        }

        console.log('[BudgetForm] Budget created successfully');
      } else {
        // Update mode
        await updateBudget(budget!.id, {
          period,
          total_budget: totalBudget,
          description,
        });

        console.log('[BudgetForm] Budget updated successfully');
      }

      onSuccess();
    } catch (err: any) {
      console.error('[BudgetForm] Error:', err);
      setError(err.message || 'Gagal menyimpan budget');
    } finally {
      setLoading(false);
    }
  };

  // Handle add item
  const handleAddItem = () => {
    if (!selectedAccount) {
      setError('Pilih akun terlebih dahulu');
      return;
    }

    if (itemAmount <= 0) {
      setError('Jumlah budget harus lebih dari 0');
      return;
    }

    // Check duplicate
    const isDuplicate = budgetItems.some(
      (item) => item.account_code === selectedAccount.account_code
    );

    if (isDuplicate) {
      setError(`Akun ${selectedAccount.account_code} sudah ada di budget ini`);
      return;
    }

    const newItem: BudgetItem = {
      id: '', // Temporary ID for display
      budget_id: budget?.id || '',
      account_id: selectedAccount.id,
      accurate_id: selectedAccount.accurate_id,
      account_code: selectedAccount.account_code,
      account_name: selectedAccount.account_name,
      account_type: selectedAccount.account_type,
      allocated_amount: itemAmount,
      description: itemDescription,
    };

    setBudgetItems([...budgetItems, newItem]);

    // Reset form
    setSelectedAccount(null);
    setItemAmount(0);
    setItemDescription('');
    setSearchAccount('');
    setShowAddItem(false);
    setError(null);
  };

  // Handle add item to existing budget
  const handleAddItemToExistingBudget = async () => {
    if (!budget?.id || !selectedAccount) return;

    if (itemAmount <= 0) {
      setError('Jumlah budget harus lebih dari 0');
      return;
    }

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
        allocated_amount: itemAmount,
        description: itemDescription,
      });

      if (addError) throw addError;

      setBudgetItems([...budgetItems, data!]);

      // Reset
      setSelectedAccount(null);
      setItemAmount(0);
      setItemDescription('');
      setSearchAccount('');
      setShowAddItem(false);
    } catch (err: any) {
      console.error('[BudgetForm] Error adding item:', err);
      setError(err.message || 'Gagal menambah item');
    } finally {
      setLoading(false);
    }
  };

  // Handle delete item
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

  // Filter accounts by search
  const filteredAccounts = availableAccounts.filter(
    (acc) =>
      acc.account_code.toLowerCase().includes(searchAccount.toLowerCase()) ||
      acc.account_name.toLowerCase().includes(searchAccount.toLowerCase())
  );

  return (
    <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
      <h3 style={{ margin: '0 0 1rem', fontSize: '18px', fontWeight: 600 }}>
        {mode === 'create' ? 'Tambah Budget Baru' : 'Edit Budget'}
      </h3>

      <form onSubmit={handleSubmit}>
        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#f8d7da',
              color: '#721c24',
              borderRadius: '6px',
              marginBottom: '1rem',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Form Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Periode (YYYY-MM) *
            </label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Total Budget (IDR) *
            </label>
            <input
              type="number"
              value={totalBudget}
              onChange={(e) => setTotalBudget(Number(e.target.value))}
              required
              min={0}
              step={1000}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Deskripsi
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={loading}
            placeholder="Deskripsi budget..."
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Budget Summary */}
        <div
          style={{
            padding: '1rem',
            backgroundColor: isOverBudget ? '#fff3cd' : '#d1ecf1',
            borderRadius: '6px',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', fontSize: '14px' }}>
            <div>
              <div style={{ color: '#666', marginBottom: '4px' }}>Total Budget</div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>
                Rp {totalBudget.toLocaleString('id-ID')}
              </div>
            </div>
            <div>
              <div style={{ color: '#666', marginBottom: '4px' }}>Total Allocated</div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: isOverBudget ? '#dc3545' : '#28a745' }}>
                Rp {totalAllocated.toLocaleString('id-ID')}
              </div>
            </div>
            <div>
              <div style={{ color: '#666', marginBottom: '4px' }}>Remaining</div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: isOverBudget ? '#dc3545' : '#0066cc' }}>
                Rp {remaining.toLocaleString('id-ID')}
              </div>
            </div>
          </div>
          {isOverBudget && (
            <div style={{ marginTop: '8px', color: '#856404', fontSize: '14px' }}>
              ⚠️ Total allocated melebihi budget sebesar Rp {Math.abs(remaining).toLocaleString('id-ID')}
            </div>
          )}
        </div>

        {/* Budget Items */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Budget Items ({budgetItems.length})</h4>
            <button
              type="button"
              onClick={() => setShowAddItem(!showAddItem)}
              disabled={loading}
              style={{
                padding: '6px 12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {showAddItem ? '✕ Batal' : '+ Tambah Item'}
            </button>
          </div>

          {/* Add Item Form */}
          {showAddItem && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: 'white',
                border: '1px solid #ddd',
                borderRadius: '6px',
                marginBottom: '1rem',
              }}
            >
              <h5 style={{ margin: '0 0 1rem', fontSize: '14px', fontWeight: 600 }}>Tambah Item Baru</h5>

              {/* Account Search */}
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '13px', fontWeight: 500 }}>
                  Cari Akun
                </label>
                <input
                  type="text"
                  value={searchAccount}
                  onChange={(e) => setSearchAccount(e.target.value)}
                  placeholder="Cari kode atau nama akun..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
              </div>

              {/* Account Select */}
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '13px', fontWeight: 500 }}>
                  Pilih Akun *
                </label>
                <select
                  value={selectedAccount?.id || ''}
                  onChange={(e) => {
                    const acc = filteredAccounts.find((a) => a.id === e.target.value);
                    setSelectedAccount(acc || null);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                >
                  <option value="">-- Pilih Akun --</option>
                  {filteredAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_code} - {acc.account_name} ({acc.account_type})
                    </option>
                  ))}
                </select>
                {filteredAccounts.length === 0 && searchAccount && (
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#dc3545' }}>
                    Tidak ada akun yang cocok
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '13px', fontWeight: 500 }}>
                    Jumlah (IDR) *
                  </label>
                  <input
                    type="number"
                    value={itemAmount}
                    onChange={(e) => setItemAmount(Number(e.target.value))}
                    min={0}
                    step={1000}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '13px', fontWeight: 500 }}>
                    Deskripsi Item
                  </label>
                  <input
                    type="text"
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    placeholder="Deskripsi untuk item ini..."
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={mode === 'edit' && budget?.id ? handleAddItemToExistingBudget : handleAddItem}
                disabled={!selectedAccount || itemAmount <= 0 || loading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: !selectedAccount || itemAmount <= 0 || loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  opacity: !selectedAccount || itemAmount <= 0 || loading ? 0.6 : 1,
                }}
              >
                ✓ Tambahkan Item
              </button>
            </div>
          )}

          {/* Items Table */}
          {budgetItems.length === 0 ? (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                backgroundColor: 'white',
                border: '1px dashed #ddd',
                borderRadius: '6px',
                color: '#6c757d',
              }}
            >
              Belum ada budget items. Klik "Tambah Item" untuk menambahkan.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #ddd' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={tableHeaderStyle}>Kode Akun</th>
                    <th style={tableHeaderStyle}>Nama Akun</th>
                    <th style={tableHeaderStyle}>Tipe</th>
                    <th style={tableHeaderStyle}>Jumlah Budget</th>
                    <th style={tableHeaderStyle}>Deskripsi</th>
                    <th style={tableHeaderStyle}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetItems.map((item, index) => (
                    <tr key={item.id || index} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={tableCellStyle}>
                        <strong>{item.account_code}</strong>
                      </td>
                      <td style={tableCellStyle}>{item.account_name}</td>
                      <td style={tableCellStyle}>
                        <span
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#e7f3ff',
                            color: '#0066cc',
                            borderRadius: '4px',
                            fontSize: '12px',
                          }}
                        >
                          {item.account_type}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <strong>Rp {item.allocated_amount.toLocaleString('id-ID')}</strong>
                      </td>
                      <td style={tableCellStyle}>{item.description || '-'}</td>
                      <td style={tableCellStyle}>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id, item.account_code)}
                          disabled={loading}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          🗑️ Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={loading || !period || totalBudget <= 0}
            style={{
              padding: '10px 20px',
              backgroundColor: loading || !period || totalBudget <= 0 ? '#adb5bd' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading || !period || totalBudget <= 0 ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {loading ? 'Menyimpan...' : mode === 'create' ? 'Simpan Budget' : 'Update Budget'}
          </button>
        </div>
      </form>
    </div>
  );
};

const tableHeaderStyle: React.CSSProperties = {
  padding: '12px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '13px',
  textTransform: 'uppercase',
  borderBottom: '2px solid #dee2e6',
};

const tableCellStyle: React.CSSProperties = {
  padding: '12px',
};