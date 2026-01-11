import React, { useState, useEffect } from 'react';
import { useEntity } from '../contexts/EntityContext';
import {
  createBudget,
  updateBudget,
  addBudgetItem,
  deleteBudgetItem,
  getAvailableAccountsForBudget,
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

// Helper: Get adaptive font size based on amount
const getAdaptiveFontSize = (amount: number): number => {
  if (amount >= 1_000_000_000_000) return 14; // >= 1 Triliun
  if (amount >= 1_000_000_000) return 16;      // 1-999 Miliar
  return 20;                                    // < 1 Miliar
};

// Helper: Format currency - NO abbreviations, full number
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('id-ID');
};

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
  const [totalBudget, setTotalBudget] = useState<number | ''>(budget?.total_budget || ''); // EMPTY default
  const [description, setDescription] = useState(budget?.description || '');

  // Items state
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(items);
  const [availableAccounts, setAvailableAccounts] = useState<Account[]>([]);

  // New item state
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [itemAmount, setItemAmount] = useState<number | ''>(''); // EMPTY default
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

  // Calculate totals
  const totalAllocated = budgetItems.reduce((sum, item) => sum + item.allocated_amount, 0);
  const budgetValue = typeof totalBudget === 'number' ? totalBudget : 0;
  const remaining = budgetValue - totalAllocated;
  const isOverBudget = totalAllocated > budgetValue;

  // Check for warnings
  useEffect(() => {
    const newWarnings: string[] = [];
    
    // Check total budget
    if (typeof totalBudget === 'number' && totalBudget > 0 && totalBudget % 1000 !== 0) {
      newWarnings.push('Total budget: Disarankan gunakan angka bulat ribuan (kelipatan 1.000)');
    }
    
    // Check item amount
    if (typeof itemAmount === 'number' && itemAmount > 0 && itemAmount % 1000 !== 0) {
      newWarnings.push('Jumlah alokasi: Disarankan gunakan angka bulat ribuan (kelipatan 1.000)');
    }
    
    setWarnings(newWarnings);
  }, [totalBudget, itemAmount]);

  // Handle account selection - AUTO-FILL BALANCE
  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    
    if (!accountId) {
      setItemAmount('');
      return;
    }

    // Find selected account
    const account = availableAccounts.find(a => a.id === accountId);
    
    if (account) {
      // Auto-fill amount from account balance
      console.log('[BudgetForm] Auto-filling amount from balance:', account.balance);
      setItemAmount(account.balance || 0);
    }
  };

  // Handle submit budget
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

    if (totalBudget === '' || totalBudget <= 0) {
      setError('Total budget harus diisi dan lebih dari 0');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'create') {
        const { data: newBudget, error: budgetError } = await createBudget({
          entity_id: activeEntity.id,
          name: name.trim(),
          period,
          total_budget: Number(totalBudget),
          description: description.trim(),
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
          name: name.trim(),
          period,
          total_budget: Number(totalBudget),
          description: description.trim(),
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
      allocated_amount: Number(itemAmount),
      description: itemDescription.trim(),
    };

    setBudgetItems([...budgetItems, newItem]);

    // Reset form
    setSelectedAccountId('');
    setItemAmount('');
    setItemDescription('');
    setAccountFilter('');
    setShowAddItem(false);
    setError(null);
  };

  // Handle add item to existing budget
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
        allocated_amount: Number(itemAmount),
        description: itemDescription.trim(),
      });

      if (addError) throw addError;

      setBudgetItems([...budgetItems, data!]);

      // Reset
      setSelectedAccountId('');
      setItemAmount('');
      setItemDescription('');
      setAccountFilter('');
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

  // Filter accounts for dropdown
  const filteredAccounts = availableAccounts.filter(
    (acc) =>
      acc.account_code.toLowerCase().includes(accountFilter.toLowerCase()) ||
      acc.account_name.toLowerCase().includes(accountFilter.toLowerCase())
  );

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #dee2e6',
        backgroundColor: '#f8f9fa',
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '20px',
          fontWeight: 600,
          color: '#212529',
        }}>
          {mode === 'create' ? '📝 Buat Budget Baru' : '✏️ Edit Budget'}
        </h2>
        <p style={{
          margin: '4px 0 0',
          fontSize: '14px',
          color: '#6c757d',
        }}>
          {mode === 'create' 
            ? 'Buat budget baru dan alokasikan ke akun-akun perkiraan'
            : 'Edit informasi budget dan kelola alokasi akun'}
        </p>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
        {/* Error Alert */}
        {error && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '6px',
            marginBottom: '20px',
            color: '#721c24',
            fontSize: '14px',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Warning Alert */}
        {warnings.length > 0 && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '6px',
            marginBottom: '20px',
            color: '#856404',
            fontSize: '13px',
          }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>⚠️ Peringatan:</div>
            {warnings.map((warning, idx) => (
              <div key={idx}>• {warning}</div>
            ))}
          </div>
        )}

        {/* Section: Informasi Budget */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{
            margin: '0 0 16px',
            fontSize: '16px',
            fontWeight: 600,
            color: '#495057',
          }}>
            Informasi Budget
          </h3>

          {/* FIXED GRID: 1fr | 200px | 250px */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 200px 250px',
            gap: '16px',
            marginBottom: '16px',
          }}>
            {/* Nama Budget */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#212529',
              }}>
                Nama Budget <span style={{ color: '#dc3545' }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={150}
                disabled={loading}
                placeholder="Contoh: Budget Operasional Q1 2026"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
              <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '4px' }}>
                {name.length}/150 karakter
              </div>
            </div>

            {/* Periode */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#212529',
              }}>
                Periode <span style={{ color: '#dc3545' }}>*</span>
              </label>
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </div>

            {/* Total Budget */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#212529',
              }}>
                Total Budget (IDR) <span style={{ color: '#dc3545' }}>*</span>
              </label>
              <input
                type="number"
                value={totalBudget}
                onChange={(e) => {
                  const value = e.target.value;
                  // Limit to 15 digits
                  if (value === '' || value.replace(/\D/g, '').length <= 15) {
                    setTotalBudget(value === '' ? '' : Number(value));
                  }
                }}
                onKeyPress={(e) => {
                  // Prevent input if already 15 digits
                  const currentValue = (totalBudget || '').toString().replace(/\D/g, '');
                  if (currentValue.length >= 15 && e.key !== 'Backspace' && e.key !== 'Delete') {
                    e.preventDefault();
                  }
                }}
                required
                min={0}
                max={999_999_999_999_999}
                step={1}
                disabled={loading}
                placeholder="Masukkan nominal (max 15 digit)"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
              <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '4px' }}>
                Maksimal 15 digit (999 Triliun)
              </div>
            </div>
          </div>

          {/* Deskripsi - FULL WIDTH */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#212529',
            }}>
              Deskripsi
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              disabled={loading}
              placeholder="Deskripsi budget (opsional)..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '4px' }}>
              {description.length}/500 karakter
            </div>
          </div>
        </div>

        {/* Budget Summary - EQUAL 3 COLUMNS */}
        <div style={{
          padding: '16px',
          backgroundColor: isOverBudget ? '#fff3cd' : '#d1ecf1',
          border: `1px solid ${isOverBudget ? '#ffc107' : '#bee5eb'}`,
          borderRadius: '6px',
          marginBottom: '24px',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '16px',
          }}>
            <div>
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#6c757d',
                marginBottom: '4px',
                textTransform: 'uppercase',
              }}>
                Total Budget
              </div>
              <div style={{
                fontSize: `${getAdaptiveFontSize(budgetValue)}px`,
                fontWeight: 600,
                color: '#212529',
              }}>
                Rp {formatCurrency(budgetValue)}
              </div>
            </div>

            <div>
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#6c757d',
                marginBottom: '4px',
                textTransform: 'uppercase',
              }}>
                Total Alokasi
              </div>
              <div style={{
                fontSize: `${getAdaptiveFontSize(totalAllocated)}px`,
                fontWeight: 600,
                color: isOverBudget ? '#dc3545' : '#28a745',
              }}>
                Rp {formatCurrency(totalAllocated)}
              </div>
            </div>

            <div>
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#6c757d',
                marginBottom: '4px',
                textTransform: 'uppercase',
              }}>
                Sisa Budget
              </div>
              <div style={{
                fontSize: `${getAdaptiveFontSize(Math.abs(remaining))}px`,
                fontWeight: 600,
                color: isOverBudget ? '#dc3545' : '#0066cc',
              }}>
                Rp {formatCurrency(remaining)}
              </div>
            </div>
          </div>

          {isOverBudget && (
            <div style={{
              marginTop: '12px',
              padding: '8px 12px',
              backgroundColor: 'rgba(220, 53, 69, 0.1)',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#721c24',
            }}>
              ⚠️ Total alokasi melebihi budget sebesar Rp {formatCurrency(Math.abs(remaining))}
            </div>
          )}
        </div>

        {/* Section: Alokasi Budget */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: '#495057',
            }}>
              Alokasi Budget ke Akun ({budgetItems.length})
            </h3>

            <button
              type="button"
              onClick={() => setShowAddItem(!showAddItem)}
              disabled={loading}
              style={{
                padding: '8px 16px',
                backgroundColor: showAddItem ? '#6c757d' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              {showAddItem ? '✕ Tutup' : '+ Tambah Akun'}
            </button>
          </div>

          {/* Add Item Form */}
          {showAddItem && (
            <div style={{
              padding: '16px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              marginBottom: '16px',
            }}>
              <h4 style={{
                margin: '0 0 16px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#495057',
              }}>
                Tambah Akun ke Budget
              </h4>

              {/* Search/Filter Input */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                }}>
                  Cari Akun <span style={{ color: '#dc3545' }}>*</span>
                </label>
                <input
                  type="text"
                  value={accountFilter}
                  onChange={(e) => setAccountFilter(e.target.value)}
                  placeholder="🔍 Ketik kode atau nama akun untuk mencari..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#007bff'}
                  onBlur={(e) => e.target.style.borderColor = '#ced4da'}
                />
              </div>

              {/* Account List */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                }}>
                  Pilih dari daftar ({filteredAccounts.length} akun tersedia)
                </label>
                
                {filteredAccounts.length === 0 ? (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    backgroundColor: 'white',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    color: '#6c757d',
                    fontSize: '14px',
                  }}>
                    {accountFilter 
                      ? `❌ Tidak ada akun yang cocok dengan "${accountFilter}"`
                      : '📋 Semua akun sudah dialokasikan'}
                  </div>
                ) : (
                  <div style={{
                    maxHeight: '240px',
                    overflowY: 'auto',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    backgroundColor: 'white',
                  }}>
                    {filteredAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        onClick={() => handleAccountSelect(acc.id)}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #f0f0f0',
                          cursor: 'pointer',
                          backgroundColor: selectedAccountId === acc.id ? '#e7f3ff' : 'white',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          if (selectedAccountId !== acc.id) {
                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedAccountId !== acc.id) {
                            e.currentTarget.style.backgroundColor = 'white';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <code style={{
                                padding: '2px 6px',
                                backgroundColor: '#e7f3ff',
                                borderRadius: '3px',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#004085',
                              }}>
                                {acc.account_code}
                              </code>
                              <span style={{
                                fontSize: '14px',
                                fontWeight: 500,
                                color: '#212529',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                {acc.account_name}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#6c757d' }}>
                              {acc.account_type_name || acc.account_type}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', marginLeft: '16px', flexShrink: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#28a745' }}>
                              Rp {formatCurrency(acc.balance || 0)}
                            </div>
                            <div style={{ fontSize: '11px', color: '#6c757d' }}>Balance</div>
                          </div>
                        </div>
                        {selectedAccountId === acc.id && (
                          <div style={{
                            marginTop: '8px',
                            padding: '6px 10px',
                            backgroundColor: '#d1ecf1',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#0c5460',
                            fontWeight: 500,
                          }}>
                            ✓ Akun dipilih
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Amount & Description */}
              {selectedAccountId && (
                <>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '200px 1fr',
                    gap: '12px',
                    marginBottom: '12px',
                  }}>
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '13px',
                        fontWeight: 500,
                      }}>
                        Jumlah (IDR) <span style={{ color: '#dc3545' }}>*</span>
                      </label>
                      <input
                        type="number"
                        value={itemAmount}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Limit to 15 digits
                          if (value === '' || value.replace(/\D/g, '').length <= 15) {
                            setItemAmount(value === '' ? '' : Number(value));
                          }
                        }}
                        onKeyPress={(e) => {
                          // Prevent input if already 15 digits
                          const currentValue = (itemAmount || '').toString().replace(/\D/g, '');
                          if (currentValue.length >= 15 && e.key !== 'Backspace' && e.key !== 'Delete') {
                            e.preventDefault();
                          }
                        }}
                        min={0}
                        max={999_999_999_999_999}
                        step={1}
                        disabled={loading}
                        placeholder="Masukkan nominal (max 15 digit)"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          fontSize: '14px',
                          fontWeight: 600,
                        }}
                      />
                      <div style={{
                        marginTop: '4px',
                        fontSize: '11px',
                        color: '#6c757d',
                      }}>
                        💡 Auto-fill dari balance • Max 15 digit
                      </div>
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '13px',
                        fontWeight: 500,
                      }}>
                        Catatan
                      </label>
                      <input
                        type="text"
                        value={itemDescription}
                        onChange={(e) => setItemDescription(e.target.value)}
                        maxLength={200}
                        disabled={loading}
                        placeholder="Catatan (opsional)..."
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          fontSize: '13px',
                        }}
                      />
                    </div>
                  </div>

                  {/* Add Button */}
                  <button
                    type="button"
                    onClick={mode === 'edit' && budget?.id ? handleAddItemToExistingBudget : handleAddItem}
                    disabled={!selectedAccountId || itemAmount === '' || itemAmount <= 0 || loading}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: !selectedAccountId || itemAmount === '' || itemAmount <= 0 || loading ? '#adb5bd' : '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: !selectedAccountId || itemAmount === '' || itemAmount <= 0 || loading ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    ✓ Tambahkan ke Budget
                  </button>
                </>
              )}
            </div>
          )}

          {/* Items Table */}
          {budgetItems.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              color: '#6c757d',
            }}>
              <div style={{ fontSize: '14px' }}>
                📋 Belum ada alokasi akun. Klik "Tambah Akun" untuk mulai.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={tableHeaderStyle}>Kode Akun</th>
                    <th style={tableHeaderStyle}>Nama Akun</th>
                    <th style={tableHeaderStyle}>Tipe</th>
                    <th style={tableHeaderStyle}>Alokasi</th>
                    <th style={tableHeaderStyle}>Catatan</th>
                    <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetItems.map((item, index) => (
                    <tr key={item.id || index} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={tableCellStyle}>
                        <code style={{
                          padding: '4px 8px',
                          backgroundColor: '#e7f3ff',
                          borderRadius: '4px',
                          fontSize: '13px',
                          fontWeight: 500,
                        }}>
                          {item.account_code}
                        </code>
                      </td>
                      <td style={tableCellStyle}>
                        <div style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '300px',
                        }}>
                          {item.account_name}
                        </div>
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{
                          padding: '4px 8px',
                          backgroundColor: '#e7f3ff',
                          color: '#004085',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}>
                          {item.account_type}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <strong style={{
                          fontSize: `${getAdaptiveFontSize(item.allocated_amount)}px`,
                        }}>
                          Rp {formatCurrency(item.allocated_amount)}
                        </strong>
                      </td>
                      <td style={{ ...tableCellStyle, color: '#6c757d', fontSize: '13px' }}>
                        <div style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '200px',
                        }}>
                          {item.description || '-'}
                        </div>
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id, item.account_code)}
                          disabled={loading}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          🗑️
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
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          paddingTop: '16px',
          borderTop: '1px solid #dee2e6',
        }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              fontSize: '14px',
            }}
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={loading || !name.trim() || !period || totalBudget === '' || totalBudget <= 0}
            style={{
              padding: '10px 24px',
              backgroundColor: loading || !name.trim() || !period || totalBudget === '' || totalBudget <= 0 ? '#adb5bd' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading || !name.trim() || !period || totalBudget === '' || totalBudget <= 0 ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            {loading ? '⏳ Menyimpan...' : mode === 'create' ? 'Simpan Budget' : 'Update Budget'}
          </button>
        </div>
      </form>
    </div>
  );
};

const tableHeaderStyle: React.CSSProperties = {
  padding: '14px 16px',
  textAlign: 'left',
  fontSize: '13px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#495057',
  borderBottom: '2px solid #dee2e6',
  borderRight: '1px solid #dee2e6',
};

const tableCellStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: '14px',
  color: '#212529',
  borderRight: '1px solid #dee2e6',
};