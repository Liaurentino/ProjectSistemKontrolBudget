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
  const [totalBudget, setTotalBudget] = useState(budget?.total_budget || 0);
  const [description, setDescription] = useState(budget?.description || '');

  // Items state
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(items);
  const [availableAccounts, setAvailableAccounts] = useState<Account[]>([]);

  // New item state
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [itemAmount, setItemAmount] = useState(0);
  const [itemDescription, setItemDescription] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);

  // Dropdown filter state
  const [accountFilter, setAccountFilter] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Handle account selection - AUTO-FILL BALANCE
  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    
    if (!accountId) {
      setItemAmount(0);
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
          name: name.trim(),
          period,
          total_budget: totalBudget,
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
          total_budget: totalBudget,
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

    if (itemAmount <= 0) {
      setError('Jumlah budget harus lebih dari 0');
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
      allocated_amount: itemAmount,
      description: itemDescription.trim(),
    };

    setBudgetItems([...budgetItems, newItem]);

    // Reset form
    setSelectedAccountId('');
    setItemAmount(0);
    setItemDescription('');
    setAccountFilter('');
    setShowAddItem(false);
    setError(null);
  };

  // Handle add item to existing budget
  const handleAddItemToExistingBudget = async () => {
    if (!budget?.id || !selectedAccountId) return;

    if (itemAmount <= 0) {
      setError('Jumlah budget harus lebih dari 0');
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
        allocated_amount: itemAmount,
        description: itemDescription.trim(),
      });

      if (addError) throw addError;

      setBudgetItems([...budgetItems, data!]);

      // Reset
      setSelectedAccountId('');
      setItemAmount(0);
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
      border: '2px solid #007bff',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      {/* ========== HEADER CONTAINER ========== */}
      <div style={{
        padding: '20px 24px',
        background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
        color: 'white',
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '24px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          {mode === 'create' ? '📝 Buat Budget Baru' : '✏️ Edit Budget'}
        </h2>
        <p style={{
          margin: '8px 0 0',
          fontSize: '14px',
          opacity: 0.9,
        }}>
          {mode === 'create' 
            ? 'Buat budget baru dan alokasikan ke akun-akun perkiraan'
            : 'Edit informasi budget dan kelola alokasi akun'}
        </p>
      </div>

      {/* ========== FORM CONTENT ========== */}
      <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
        {/* Error Alert */}
        {error && (
          <div style={{
            padding: '14px 16px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderLeft: '4px solid #ffc107',
            borderRadius: '6px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <span style={{ color: '#856404', fontSize: '14px', fontWeight: 500 }}>
              {error}
            </span>
          </div>
        )}

        {/* ========== SECTION 1: INFORMASI BUDGET ========== */}
        <div style={{
          marginBottom: '28px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6',
        }}>
          <h3 style={{
            margin: '0 0 16px',
            fontSize: '16px',
            fontWeight: 600,
            color: '#495057',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            📋 Informasi Budget
          </h3>

          {/* Nama Budget - FULL WIDTH */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#212529',
            }}>
              Nama Budget <span style={{ color: '#dc3545' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              placeholder="Contoh: Budget Operasional Q1 2026"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '2px solid #ced4da',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#ced4da'}
            />
          </div>

          {/* Periode & Total Budget - GRID */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '16px',
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#212529',
              }}>
                Periode (Bulan) <span style={{ color: '#dc3545' }}>*</span>
              </label>
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #ced4da',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#212529',
              }}>
                Total Budget (IDR) <span style={{ color: '#dc3545' }}>*</span>
              </label>
              <input
                type="number"
                value={totalBudget}
                onChange={(e) => setTotalBudget(Number(e.target.value))}
                required
                min={0}
                step={1000}
                disabled={loading}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #ced4da',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              />
            </div>
          </div>

          {/* Deskripsi */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#212529',
            }}>
              Deskripsi
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={loading}
              placeholder="Deskripsi detail tentang budget ini..."
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '2px solid #ced4da',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* ========== BUDGET SUMMARY ========== */}
        <div style={{
          padding: '20px',
          background: isOverBudget
            ? 'linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%)'
            : 'linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%)',
          borderRadius: '8px',
          marginBottom: '28px',
          border: `2px solid ${isOverBudget ? '#ffc107' : '#17a2b8'}`,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '20px',
          }}>
            <div>
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#6c757d',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Total Budget
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#212529',
              }}>
                Rp {totalBudget.toLocaleString('id-ID')}
              </div>
            </div>

            <div>
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#6c757d',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Total Alokasi
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: isOverBudget ? '#dc3545' : '#28a745',
              }}>
                Rp {totalAllocated.toLocaleString('id-ID')}
              </div>
            </div>

            <div>
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#6c757d',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Sisa Budget
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: isOverBudget ? '#dc3545' : '#0066cc',
              }}>
                Rp {remaining.toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          {isOverBudget && (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              backgroundColor: 'rgba(220, 53, 69, 0.1)',
              borderRadius: '6px',
              border: '1px solid rgba(220, 53, 69, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <span style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#721c24',
              }}>
                Total alokasi melebihi budget sebesar Rp {Math.abs(remaining).toLocaleString('id-ID')}
              </span>
            </div>
          )}
        </div>

        {/* ========== SECTION 2: ALOKASI BUDGET KE AKUN ========== */}
        <div style={{
          marginBottom: '28px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6',
        }}>
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
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              💰 Alokasi Budget ke Akun ({budgetItems.length})
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
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'background-color 0.2s',
              }}
            >
              {showAddItem ? '✕ Tutup' : '+ Tambah Akun'}
            </button>
          </div>

          {/* ========== ADD ITEM FORM ========== */}
          {showAddItem && (
            <div style={{
              padding: '20px',
              backgroundColor: 'white',
              border: '2px solid #28a745',
              borderRadius: '8px',
              marginBottom: '20px',
            }}>
              <h4 style={{
                margin: '0 0 16px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#28a745',
              }}>
                ➕ Tambah Akun ke Budget
              </h4>

              {/* Dropdown dengan built-in search */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#212529',
                }}>
                  Pilih Akun Perkiraan <span style={{ color: '#dc3545' }}>*</span>
                </label>
                
                {/* Filter Input */}
                <input
                  type="text"
                  value={accountFilter}
                  onChange={(e) => setAccountFilter(e.target.value)}
                  placeholder="Ketik untuk filter akun..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ced4da',
                    borderRadius: '6px 6px 0 0',
                    fontSize: '13px',
                    backgroundColor: '#f8f9fa',
                  }}
                />

                {/* Dropdown */}
                <select
                  value={selectedAccountId}
                  onChange={(e) => handleAccountSelect(e.target.value)}
                  disabled={loading}
                  size={Math.min(filteredAccounts.length + 1, 8)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ced4da',
                    borderTop: 'none',
                    borderRadius: '0 0 6px 6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">-- Pilih Akun --</option>
                  {filteredAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_code} - {acc.account_name} | Rp {(acc.balance || 0).toLocaleString('id-ID')}
                    </option>
                  ))}
                </select>

                {filteredAccounts.length === 0 && accountFilter && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    backgroundColor: '#fff3cd',
                    border: '1px solid #ffc107',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#856404',
                  }}>
                    ℹ️ Tidak ada akun yang cocok dengan "{accountFilter}"
                  </div>
                )}
              </div>

              {/* Amount & Description Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '200px 1fr',
                gap: '16px',
                marginBottom: '16px',
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#212529',
                  }}>
                    Jumlah Budget (IDR) <span style={{ color: '#dc3545' }}>*</span>
                  </label>
                  <input
                    type="number"
                    value={itemAmount}
                    onChange={(e) => setItemAmount(Number(e.target.value))}
                    min={0}
                    step={1000}
                    disabled={loading}
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '2px solid #ced4da',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  />
                  <div style={{
                    marginTop: '4px',
                    fontSize: '11px',
                    color: '#6c757d',
                  }}>
                    💡 Auto-fill dari balance akun
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#212529',
                  }}>
                    Catatan Item
                  </label>
                  <input
                    type="text"
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    disabled={loading}
                    placeholder="Catatan untuk item ini (opsional)..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ced4da',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              {/* Add Button */}
              <button
                type="button"
                onClick={mode === 'edit' && budget?.id ? handleAddItemToExistingBudget : handleAddItem}
                disabled={!selectedAccountId || itemAmount <= 0 || loading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: !selectedAccountId || itemAmount <= 0 || loading ? '#adb5bd' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: !selectedAccountId || itemAmount <= 0 || loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                ✓ Tambahkan ke Budget
              </button>
            </div>
          )}

          {/* ========== ITEMS TABLE ========== */}
          {budgetItems.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: 'white',
              border: '2px dashed #dee2e6',
              borderRadius: '8px',
              color: '#6c757d',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
              <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                Belum Ada Alokasi Akun
              </div>
              <div style={{ fontSize: '14px' }}>
                Klik tombol "Tambah Akun" untuk mulai mengalokasikan budget
              </div>
            </div>
          ) : (
            <div style={{
              overflowX: 'auto',
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '1px solid #dee2e6',
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px',
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#e9ecef' }}>
                    <th style={tableHeaderStyle}>Kode Akun</th>
                    <th style={tableHeaderStyle}>Nama Akun</th>
                    <th style={tableHeaderStyle}>Tipe</th>
                    <th style={tableHeaderStyle}>Alokasi Budget</th>
                    <th style={tableHeaderStyle}>Catatan</th>
                    <th style={tableHeaderStyle}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetItems.map((item, index) => (
                    <tr
                      key={item.id || index}
                      style={{
                        borderBottom: '1px solid #dee2e6',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={tableCellStyle}>
                        <code style={{
                          padding: '4px 8px',
                          backgroundColor: '#e7f3ff',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}>
                          {item.account_code}
                        </code>
                      </td>
                      <td style={tableCellStyle}>{item.account_name}</td>
                      <td style={tableCellStyle}>
                        <span style={{
                          padding: '4px 10px',
                          backgroundColor: '#d1ecf1',
                          color: '#0c5460',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}>
                          {item.account_type}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <strong style={{ fontSize: '15px' }}>
                          Rp {item.allocated_amount.toLocaleString('id-ID')}
                        </strong>
                      </td>
                      <td style={{ ...tableCellStyle, color: '#6c757d', fontSize: '13px' }}>
                        {item.description || '-'}
                      </td>
                      <td style={tableCellStyle}>
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
                            fontWeight: 600,
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

        {/* ========== ACTION BUTTONS ========== */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          paddingTop: '20px',
          borderTop: '2px solid #dee2e6',
        }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            ✕ Batal
          </button>

          <button
            type="submit"
            disabled={loading || !name.trim() || !period || totalBudget <= 0}
            style={{
              padding: '12px 32px',
              backgroundColor: loading || !name.trim() || !period || totalBudget <= 0 ? '#adb5bd' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading || !name.trim() || !period || totalBudget <= 0 ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: '14px',
            }}
          >
            {loading ? '⏳ Menyimpan...' : mode === 'create' ? '✓ Simpan Budget' : '✓ Update Budget'}
          </button>
        </div>
      </form>
    </div>
  );
};

const tableHeaderStyle: React.CSSProperties = {
  padding: '14px 16px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#495057',
  borderBottom: '2px solid #dee2e6',
};

const tableCellStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: '14px',
};