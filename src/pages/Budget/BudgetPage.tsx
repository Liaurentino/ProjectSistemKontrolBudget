import React, { useEffect, useState } from 'react';
import { useEntity } from '../../contexts/EntityContext';
import { BudgetForm } from '../../components/BudgetForm/BudgetForm';
import {
  getBudgets,
  getBudgetById,
  deleteBudget,
  subscribeBudgets,
  type Budget,
  type BudgetWithItems,
} from '../../lib/accurate';
import {
  getAdaptiveFontSize,
  formatCurrency,
} from '../../services/budgetHelpers';
import styles from './BudgetPage.module.css';

const BudgetPage: React.FC = () => {
  const { activeEntity } = useEntity();

  // State
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [allBudgets, setAllBudgets] = useState<Budget[]>([]);
  const [expandedBudgets, setExpandedBudgets] = useState<Map<string, BudgetWithItems>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithItems | null>(null);

  // Available years from ALL budgets (not filtered)
  const availableYears = Array.from(
    new Set(allBudgets.map((b) => b.period.split('-')[0]))
  ).sort((a, b) => b.localeCompare(a));

  /**
   * Load budgets
   */
  const loadBudgets = async () => {
    if (!activeEntity?.id) return;

    setLoading(true);
    setError(null);

    try {
      console.log('[BudgetPage] Loading budgets for entity:', activeEntity.id);

      const allResult = await getBudgets(activeEntity.id);
      
      if (allResult.error) throw allResult.error;
      
      setAllBudgets(allResult.data || []);

      let filteredData = allResult.data || [];
      if (selectedYear !== 'all') {
        filteredData = filteredData.filter(b => b.period.startsWith(selectedYear));
      }

      setBudgets(filteredData);
      console.log('[BudgetPage] Loaded', filteredData.length, 'budgets (filtered from', allResult.data?.length, 'total)');
    } catch (err: any) {
      console.error('[BudgetPage] Error loading budgets:', err);
      setError('Gagal memuat data budget: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Toggle expand budget (load items)
   */
  const toggleExpandBudget = async (budgetId: string) => {
    if (expandedBudgets.has(budgetId)) {
      const newExpanded = new Map(expandedBudgets);
      newExpanded.delete(budgetId);
      setExpandedBudgets(newExpanded);
    } else {
      try {
        console.log('[BudgetPage] Loading items for budget:', budgetId);
        const { data, error } = await getBudgetById(budgetId);

        if (error) throw error;

        const newExpanded = new Map(expandedBudgets);
        newExpanded.set(budgetId, data!);
        setExpandedBudgets(newExpanded);
      } catch (err: any) {
        console.error('[BudgetPage] Error loading budget items:', err);
        setError('Gagal memuat detail budget: ' + err.message);
      }
    }
  };

  /**
   * Handle delete budget
   */
  const handleDeleteBudget = async (budgetId: string, budgetName: string) => {
    if (!confirm(`Yakin ingin menghapus budget "${budgetName}"?\n\nSemua alokasi akun akan ikut terhapus.`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await deleteBudget(budgetId);
      if (error) throw error;

      console.log('[BudgetPage] Budget deleted');
      await loadBudgets();

      if (expandedBudgets.has(budgetId)) {
        const newExpanded = new Map(expandedBudgets);
        newExpanded.delete(budgetId);
        setExpandedBudgets(newExpanded);
      }
    } catch (err: any) {
      console.error('[BudgetPage] Error deleting budget:', err);
      setError('Gagal menghapus budget: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle edit budget
   */
  const handleEditBudget = async (budgetId: string) => {
    try {
      const { data, error } = await getBudgetById(budgetId);
      if (error) throw error;

      setEditingBudget(data);
      setShowForm(true);
    } catch (err: any) {
      console.error('[BudgetPage] Error loading budget for edit:', err);
      setError('Gagal memuat budget untuk edit: ' + err.message);
    }
  };

  /**
   * Handle form success
   */
  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingBudget(null);
    loadBudgets();
  };

  /**
   * Handle form cancel
   */
  const handleFormCancel = () => {
    setShowForm(false);
    setEditingBudget(null);
  };

  /**
   * Initial load
   */
  useEffect(() => {
    if (activeEntity?.id) {
      loadBudgets();
    } else {
      setBudgets([]);
    }
  }, [activeEntity?.id, selectedYear]);

  /**
   * Setup real-time subscription
   */
  useEffect(() => {
    if (!activeEntity?.id) return;

    console.log('[BudgetPage] Setting up real-time subscription...');

    const subscription = subscribeBudgets(activeEntity.id, () => {
      console.log('[BudgetPage] Real-time update detected, reloading...');
      loadBudgets();
    });

    return () => {
      console.log('[BudgetPage] Cleaning up subscription...');
      subscription.unsubscribe();
    };
  }, [activeEntity?.id]);

  /**
   * Filter budgets by search
   */
  const filteredBudgets = budgets.filter((budget) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      budget.name?.toLowerCase().includes(query) ||
      budget.period.toLowerCase().includes(query) ||
      budget.description?.toLowerCase().includes(query)
    );
  });

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2>Manajemen Budget</h2>
          {activeEntity ? (
            <p>
              Entitas: <strong>{activeEntity.entity_name || activeEntity.name || 'Unknown'}</strong>
            </p>
          ) : (
            <p className={styles.error}>
              Tidak ada entitas yang aktif
            </p>
          )}
        </div>

        <button
          onClick={() => {
            setEditingBudget(null);
            setShowForm(true);
          }}
          disabled={!activeEntity || loading}
          className={`${styles.addButton} ${
            activeEntity && !loading ? styles.active : styles.disabled
          }`}
        >
          + Tambah Budget
        </button>
      </div>

      {/* No Active Entity Warning */}
      {!activeEntity && (
        <div className={styles.noEntityWarning}>
          <h3>Belum Ada Entitas Aktif</h3>
          <p>
            Silakan pilih entitas terlebih dahulu di halaman <strong>Manajemen Entitas</strong>
          </p>
          <a href="/entitas">
            Ke Halaman Entitas →
          </a>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className={styles.errorAlert}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Budget Form */}
      {showForm && activeEntity && (
        <div className={styles.formContainer}>
          <BudgetForm
            mode={editingBudget ? 'edit' : 'create'}
            budget={editingBudget || undefined}
            items={editingBudget?.items || []}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </div>
      )}

      {/* Filters */}
      {activeEntity && !showForm && (
        <div className={styles.filterSection}>
          <div className={styles.filterGrid}>
            <div>
              <label className={styles.filterLabel}>
                Filter Tahun
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                disabled={loading}
                className={styles.filterSelect}
              >
                <option value="all">Semua Tahun</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.searchColumn}>
              <label className={styles.filterLabel}>
                Cari Budget
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, periode, atau deskripsi..."
                disabled={loading}
                className={styles.filterInput}
              />
            </div>
          </div>

          <div className={styles.filterInfo}>
            Menampilkan <strong>{filteredBudgets.length}</strong> dari {budgets.length} budget
          </div>
        </div>
      )}

      {/* Budget List */}
      {activeEntity && !showForm && (
        <div>
          {loading && budgets.length === 0 ? (
            <div className={styles.loadingState}>
              ⏳ Memuat data budget...
            </div>
          ) : filteredBudgets.length === 0 ? (
            <div className={styles.emptyState}>
              {searchQuery ? (
                <>
                  🔍 Tidak ada budget yang cocok dengan pencarian "<strong>{searchQuery}</strong>"
                </>
              ) : (
                <>
                  📋 Belum ada budget. Klik tombol "Tambah Budget" untuk membuat budget baru.
                </>
              )}
            </div>
          ) : (
            <div className={styles.budgetList}>
              {filteredBudgets.map((budget) => {
                const isExpanded = expandedBudgets.has(budget.id);
                const budgetDetails = expandedBudgets.get(budget.id);

                return (
                 <div key={budget.id} className={styles.budgetCard}>
  {/* Budget Header - HANYA NAMA & PERIODE */}
  <div
    className={styles.budgetHeader}
    onClick={() => toggleExpandBudget(budget.id)}
  >
    <div className={styles.budgetHeaderContent}>
      {/* Budget Title Only */}
      <div className={styles.budgetTitleRow}>
        <h3 className={styles.budgetTitle}>
          {budget.name}
        </h3>
        <span className={styles.budgetPeriodBadge}>
          {budget.period}
        </span>
      </div>

      {/* Expand Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleExpandBudget(budget.id);
        }}
        className={`${styles.expandButton} ${
          isExpanded ? styles.expanded : ''
        }`}
      >
        ▼
      </button>
    </div>
  </div>

  {/* Budget Details (Expanded) */}
  {isExpanded && budgetDetails && (
    <div className={styles.budgetDetails}>
      {/* Items Table LANGSUNG DI ATAS */}
      {budgetDetails.items.length === 0 ? (
        <div className={styles.emptyItems}>
          Belum ada alokasi akun. Klik "Edit" untuk menambahkan.
        </div>
      ) : (
        <div className={styles.itemsTableWrapper}>
          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th>Kode Akun</th>
                <th>Nama Akun</th>
                <th>Tipe</th>
                <th>Budget</th>
                <th>Realisasi</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {budgetDetails.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <code className={styles.accountCode}>
                      {item.account_code}
                    </code>
                  </td>
                  <td>
                    <div className={styles.accountName}>
                      {item.account_name}
                    </div>
                  </td>
                  <td>
                    <span className={styles.accountTypeBadge}>
                      {item.account_type}
                    </span>
                  </td>
                  <td>
                    <strong
                      style={{
                        fontSize: `${getAdaptiveFontSize(item.allocated_amount)}px`,
                      }}
                    >
                      Rp {formatCurrency(item.allocated_amount)}
                    </strong>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: `${getAdaptiveFontSize(item.realisasi_snapshot || 0)}px`,
                        color: '#0369a1',
                      }}
                    >
                      Rp {formatCurrency(item.realisasi_snapshot || 0)}
                    </span>
                  </td>
                  <td>
                    <div className={styles.itemDescription}>
                      {item.description || '-'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Box - DI BAWAH TABLE */}
      <div className={`${styles.summaryBox} ${
        budgetDetails.status === 'OVER_BUDGET'
          ? styles.overBudget
          : budgetDetails.status === 'FULLY_ALLOCATED'
          ? styles.fullyAllocated
          : styles.available
      }`}>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <div className={styles.summaryLabel}>
              Total Budget (Target)
            </div>
            <div
              className={styles.summaryValue}
              style={{ fontSize: `${getAdaptiveFontSize(budgetDetails.total_allocated)}px` }}
            >
              Rp {formatCurrency(budgetDetails.total_allocated)}
            </div>
          </div>

          <div className={styles.summaryItem}>
            <div className={styles.summaryLabel}>
              Total Realisasi (Aktual)
            </div>
            <div
              className={styles.summaryValue}
              style={{
                fontSize: `${getAdaptiveFontSize(budgetDetails.total_realisasi || 0)}px`,
                color: '#0369a1',
              }}
            >
              Rp {formatCurrency(budgetDetails.total_realisasi || 0)}
            </div>
          </div>

          <div className={styles.summaryItem}>
            <div className={styles.summaryLabel}>
              Jumlah Akun
            </div>
            <div className={styles.summaryValue} style={{ fontSize: '20px' }}>
              {budgetDetails.items.length} akun
            </div>
          </div>

          <div className={styles.summaryItem}>
            <div className={styles.summaryLabel}>
              Status
            </div>
            <div
              className={`${styles.statusBadge} ${
                budgetDetails.status === 'OVER_BUDGET'
                  ? styles.overBudget
                  : budgetDetails.status === 'FULLY_ALLOCATED'
                  ? styles.fullyAllocated
                  : styles.available
              }`}
            >
              {budgetDetails.status === 'OVER_BUDGET'
                ? '⚠ Over'
                : budgetDetails.status === 'FULLY_ALLOCATED'
                ? '✓ Penuh'
                : '○ Tersedia'}
            </div>
          </div>
        </div>

        {/* Deskripsi - JIKA ADA */}
        {budget.description && (
          <div className={styles.descriptionSection}>
            <div className={styles.descriptionLabel}>Deskripsi:</div>
            <div className={styles.descriptionText}>{budget.description}</div>
          </div>
        )}
      </div>

      {/* Action Buttons - PALING BAWAH */}
      <div className={styles.actionButtons}>
        <button
          onClick={() => handleEditBudget(budget.id)}
          disabled={loading}
          className={`${styles.editButton} ${
            loading ? styles.disabled : styles.active
          }`}
        >
          ✏️ Edit
        </button>

        <button
          onClick={() => handleDeleteBudget(budget.id, budget.name)}
          disabled={loading}
          className={`${styles.deleteButton} ${
            loading ? styles.disabled : styles.active
          }`}
        >
          🗑️ Hapus
        </button>
      </div>
    </div>
  )}
</div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BudgetPage;