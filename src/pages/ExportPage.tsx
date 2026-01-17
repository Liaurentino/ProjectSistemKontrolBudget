import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Document, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, Packer, BorderStyle } from 'docx';
import { useEntity } from '../contexts/EntityContext';
import { 
  getBudgetRealizationsLive, 
  getAvailableBudgetGroups,
  getAvailableRealizationPeriods,
  type BudgetRealization 
} from '../lib/accurate';

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('id-ID');
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

interface GroupedBudgetRealization {
  budget_group_name: string;
  period: string;
  total_budget: number;
  total_realisasi: number;
  total_variance: number;
  variance_percentage: number;
  status: 'ON_TRACK' | 'OVER_BUDGET';
  accounts: BudgetRealization[];
}

const ExportPage: React.FC = () => {
  const { activeEntity } = useEntity();
  
  const [realizations, setRealizations] = useState<BudgetRealization[]>([]);
  const [groupedData, setGroupedData] = useState<GroupedBudgetRealization[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedBudgetGroup, setSelectedBudgetGroup] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [availableBudgetGroups, setAvailableBudgetGroups] = useState<string[]>([]);
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);

  // Selected group for export
  const [selectedGroupForExport, setSelectedGroupForExport] = useState<GroupedBudgetRealization | null>(null);

  useEffect(() => {
    if (activeEntity?.id) {
      loadAvailableFilters();
      loadData();
    }
  }, [activeEntity?.id]);

  useEffect(() => {
    if (activeEntity?.id && selectedBudgetGroup) {
      loadData();
    }
  }, [activeEntity?.id, selectedBudgetGroup, selectedPeriod]);

  const loadAvailableFilters = async () => {
    if (!activeEntity) return;

    const { data: groups } = await getAvailableBudgetGroups(activeEntity.id);
    const { data: periods } = await getAvailableRealizationPeriods(activeEntity.id);

    setAvailableBudgetGroups(groups || []);
    setAvailablePeriods(periods || []);
  };

  const loadData = async () => {
    if (!activeEntity || !selectedBudgetGroup) return;

    setLoading(true);
    setError(null);

    try {
      const period = selectedPeriod === 'all' ? undefined : selectedPeriod;

      const { data, error: fetchError } = await getBudgetRealizationsLive(
        activeEntity.id,
        period,
        undefined,
        selectedBudgetGroup
      );
      
      if (fetchError) throw fetchError;

      setRealizations(data || []);

      // Group data
      const grouped = groupRealizationsByBudgetGroup(data || []);
      setGroupedData(grouped);

      // Auto-select first group for export
      if (grouped.length > 0) {
        setSelectedGroupForExport(grouped[0]);
      }

      console.log('[ExportPage] Data loaded:', data?.length);
    } catch (err: any) {
      console.error('[ExportPage] Error:', err);
      setError('Gagal memuat data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const groupRealizationsByBudgetGroup = (data: BudgetRealization[]): GroupedBudgetRealization[] => {
    const groupMap = new Map<string, BudgetRealization[]>();

    data.forEach(item => {
      const budgetName = item.budgets?.name || 'Unknown Budget';
      const key = `${budgetName}|||${item.period}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(item);
    });

    const grouped: GroupedBudgetRealization[] = [];
    groupMap.forEach((accounts, key) => {
      const [budgetGroupName, period] = key.split('|||');
      
      const totalBudget = accounts.reduce((sum, acc) => sum + acc.budget_allocated, 0);
      const totalRealisasi = accounts.reduce((sum, acc) => sum + acc.realisasi, 0);
      const totalVariance = totalBudget - totalRealisasi;
      const variancePercentage = totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0;
      const status = totalRealisasi <= totalBudget ? 'ON_TRACK' : 'OVER_BUDGET';

      grouped.push({
        budget_group_name: budgetGroupName,
        period,
        total_budget: totalBudget,
        total_realisasi: totalRealisasi,
        total_variance: totalVariance,
        variance_percentage: variancePercentage,
        status,
        accounts,
      });
    });

    return grouped;
  };

  // Export to Excel
  const exportToExcel = () => {
    if (!selectedGroupForExport || !activeEntity) {
      alert('Silakan pilih budget group terlebih dahulu');
      return;
    }

    setExporting(true);

    try {
      const group = selectedGroupForExport;

      // Prepare header data
      const headerData = [
        ['LAPORAN BUDGET VS REALISASI'],
        [],
        ['Entitas', activeEntity.entity_name || activeEntity.name],
        ['Nama Budget', group.budget_group_name],
        ['Periode', group.period],
        ['Tanggal Export', formatDate(new Date())],
        [],
        ['RINGKASAN'],
        ['Total Budget', `Rp ${formatCurrency(group.total_budget)}`],
        ['Total Realisasi', `Rp ${formatCurrency(group.total_realisasi)}`],
        ['Total Variance', `Rp ${formatCurrency(Math.abs(group.total_variance))}`],
        ['Variance %', `${Math.abs(group.variance_percentage).toFixed(2)}%`],
        ['Status', group.status === 'ON_TRACK' ? 'On Track' : 'Over Budget'],
        ['Jumlah Akun', group.accounts.length],
        [],
        [], // Space before table
      ];

      // Prepare table data
      const tableHeader = [
        'No',
        'Kode Akun',
        'Nama Akun',
        'Tipe Akun',
        'Budget (Rp)',
        'Realisasi (Rp)',
        'Variance (Rp)',
        'Variance (%)',
        'Status'
      ];

      const tableData = group.accounts.map((account, index) => [
        index + 1,
        account.account_code,
        account.account_name,
        account.account_type || '-',
        account.budget_allocated,
        account.realisasi,
        Math.abs(account.variance),
        `${Math.abs(account.variance_percentage).toFixed(2)}%`,
        account.status === 'ON_TRACK' ? 'On Track' : 'Over Budget'
      ]);

      // Combine all data
      const allData = [
        ...headerData,
        tableHeader,
        ...tableData
      ];

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(allData);

      // Merge cells for title
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, // Title
      ];

      // Set column widths
      ws['!cols'] = [
        { wch: 5 },  // No
        { wch: 15 }, // Kode Akun
        { wch: 40 }, // Nama Akun
        { wch: 15 }, // Tipe Akun
        { wch: 20 }, // Budget
        { wch: 20 }, // Realisasi
        { wch: 20 }, // Variance
        { wch: 12 }, // Variance %
        { wch: 15 }, // Status
      ];

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Budget Realization');

      // Save file
      const fileName = `Budget_Realization_${group.budget_group_name.replace(/\s+/g, '_')}_${group.period}_${new Date().getTime()}.xlsx`;
      XLSX.writeFile(wb, fileName);

      alert('✅ Export Excel berhasil!');
      console.log('[ExportPage] Excel exported successfully');
    } catch (err: any) {
      console.error('[ExportPage] Excel export error:', err);
      setError('Gagal export Excel: ' + err.message);
      alert('❌ Gagal export Excel: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  // Export to Word (Template Kosong)
  const exportToWord = async () => {
    if (!selectedGroupForExport || !activeEntity) {
      alert('Silakan pilih budget group terlebih dahulu');
      return;
    }

    setExporting(true);

    try {
      const group = selectedGroupForExport;

      // Create document dengan template kosong
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Title
            new Paragraph({
              text: 'LAPORAN BUDGET VS REALISASI',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
            }),

            // Metadata Section
            new Paragraph({
              text: 'Informasi Laporan',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 200 },
            }),
            
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph('Entitas')],
                      width: { size: 30, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                      children: [new Paragraph(activeEntity.entity_name || activeEntity.name)],
                      width: { size: 70, type: WidthType.PERCENTAGE },
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Nama Budget')] }),
                    new TableCell({ children: [new Paragraph(group.budget_group_name)] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Periode')] }),
                    new TableCell({ children: [new Paragraph(group.period)] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Tanggal Export')] }),
                    new TableCell({ children: [new Paragraph(formatDate(new Date()))] }),
                  ],
                }),
              ],
            }),

            new Paragraph({ text: '', spacing: { before: 300, after: 200 } }),

            // Ringkasan Section
            new Paragraph({
              text: 'Ringkasan',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 200 },
            }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Total Budget')] }),
                    new TableCell({ children: [new Paragraph(`Rp ${formatCurrency(group.total_budget)}`)] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Total Realisasi')] }),
                    new TableCell({ children: [new Paragraph(`Rp ${formatCurrency(group.total_realisasi)}`)] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Total Variance')] }),
                    new TableCell({ children: [new Paragraph(`Rp ${formatCurrency(Math.abs(group.total_variance))}`)] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Variance %')] }),
                    new TableCell({ children: [new Paragraph(`${Math.abs(group.variance_percentage).toFixed(2)}%`)] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Status')] }),
                    new TableCell({ children: [new Paragraph(group.status === 'ON_TRACK' ? 'On Track' : 'Over Budget')] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Jumlah Akun')] }),
                    new TableCell({ children: [new Paragraph(group.accounts.length.toString())] }),
                  ],
                }),
              ],
            }),

            new Paragraph({ text: '', spacing: { before: 300, after: 200 } }),

            // Detail Akun Section
            new Paragraph({
              text: 'Detail Per Akun',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 200 },
            }),

            // Table Detail
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                // Header Row
                new TableRow({
                  tableHeader: true,
                  children: [
                    new TableCell({ children: [new Paragraph({ text: 'No', bold: true })] }),
                    new TableCell({ children: [new Paragraph({ text: 'Kode Akun', bold: true })] }),
                    new TableCell({ children: [new Paragraph({ text: 'Nama Akun', bold: true })] }),
                    new TableCell({ children: [new Paragraph({ text: 'Tipe', bold: true })] }),
                    new TableCell({ children: [new Paragraph({ text: 'Budget (Rp)', bold: true })] }),
                    new TableCell({ children: [new Paragraph({ text: 'Realisasi (Rp)', bold: true })] }),
                    new TableCell({ children: [new Paragraph({ text: 'Variance (Rp)', bold: true })] }),
                    new TableCell({ children: [new Paragraph({ text: 'Variance %', bold: true })] }),
                    new TableCell({ children: [new Paragraph({ text: 'Status', bold: true })] }),
                  ],
                }),
                // Data Rows
                ...group.accounts.map((account, index) => 
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph((index + 1).toString())] }),
                      new TableCell({ children: [new Paragraph(account.account_code)] }),
                      new TableCell({ children: [new Paragraph(account.account_name)] }),
                      new TableCell({ children: [new Paragraph(account.account_type || '-')] }),
                      new TableCell({ children: [new Paragraph(formatCurrency(account.budget_allocated))] }),
                      new TableCell({ children: [new Paragraph(formatCurrency(account.realisasi))] }),
                      new TableCell({ children: [new Paragraph(formatCurrency(Math.abs(account.variance)))] }),
                      new TableCell({ children: [new Paragraph(`${Math.abs(account.variance_percentage).toFixed(2)}%`)] }),
                      new TableCell({ children: [new Paragraph(account.status === 'ON_TRACK' ? 'On Track' : 'Over Budget')] }),
                    ],
                  })
                ),
              ],
            }),

            new Paragraph({ text: '', spacing: { before: 400 } }),

            // Catatan Section (Template Kosong)
            new Paragraph({
              text: 'Catatan & Analisis',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 200 },
            }),
            new Paragraph({ text: '(Isi catatan dan analisis di sini)' }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: '' }),

            new Paragraph({ text: '', spacing: { before: 300 } }),

            // Tanda Tangan Section (Template Kosong)
            new Paragraph({
              text: 'Tanda Tangan',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 200 },
            }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({ text: 'Dibuat Oleh:', alignment: AlignmentType.CENTER }),
                        new Paragraph({ text: '', spacing: { before: 600 } }),
                        new Paragraph({ text: '___________________', alignment: AlignmentType.CENTER }),
                        new Paragraph({ text: '(Nama & Tanggal)', alignment: AlignmentType.CENTER }),
                      ],
                      width: { size: 33, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ text: 'Diperiksa Oleh:', alignment: AlignmentType.CENTER }),
                        new Paragraph({ text: '', spacing: { before: 600 } }),
                        new Paragraph({ text: '___________________', alignment: AlignmentType.CENTER }),
                        new Paragraph({ text: '(Nama & Tanggal)', alignment: AlignmentType.CENTER }),
                      ],
                      width: { size: 33, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ text: 'Disetujui Oleh:', alignment: AlignmentType.CENTER }),
                        new Paragraph({ text: '', spacing: { before: 600 } }),
                        new Paragraph({ text: '___________________', alignment: AlignmentType.CENTER }),
                        new Paragraph({ text: '(Nama & Tanggal)', alignment: AlignmentType.CENTER }),
                      ],
                      width: { size: 33, type: WidthType.PERCENTAGE },
                    }),
                  ],
                }),
              ],
            }),
          ],
        }],
      });

      // Generate and save
      const blob = await Packer.toBlob(doc);
      const fileName = `Budget_Realization_${group.budget_group_name.replace(/\s+/g, '_')}_${group.period}_${new Date().getTime()}.docx`;
      saveAs(blob, fileName);

      alert('✅ Export Word berhasil!');
      console.log('[ExportPage] Word exported successfully');
    } catch (err: any) {
      console.error('[ExportPage] Word export error:', err);
      setError('Gagal export Word: ' + err.message);
      alert('❌ Gagal export Word: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }}>📥 Export Data Budget Realization</h2>
        <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6c757d' }}>
          Export laporan Budget vs Realisasi per Budget Group ke Excel atau Word
        </p>
        {activeEntity && (
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6c757d' }}>
            Entitas: <strong>{activeEntity.entity_name || activeEntity.name}</strong>
          </p>
        )}
      </div>

      {/* No Entity Warning */}
      {!activeEntity && (
        <div style={{
          padding: '60px 20px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          textAlign: 'center',
        }}>
          <h3 style={{ margin: '0 0 8px', color: '#856404' }}>Belum Ada Entitas Aktif</h3>
          <p style={{ margin: 0, color: '#856404' }}>
            Silakan pilih entitas terlebih dahulu di halaman Manajemen Entitas
          </p>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '6px',
          color: '#721c24',
          marginBottom: '16px',
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Main Content */}
      {activeEntity && (
        <>
          {/* Filter Section */}
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '16px',
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600 }}>
              🔍 Pilih Budget Group untuk di-Export
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '16px',
              marginBottom: '16px',
            }}>
              {/* Budget Group Filter */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#495057',
                }}>
                  Nama Budget Group <span style={{ color: '#dc3545' }}>*</span>
                </label>
                <select
                  value={selectedBudgetGroup}
                  onChange={(e) => setSelectedBudgetGroup(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                >
                  <option value="">-- Pilih Budget Group --</option>
                  {availableBudgetGroups.map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>

              {/* Period Filter */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#495057',
                }}>
                  Periode
                </label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  disabled={!selectedBudgetGroup}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                    opacity: !selectedBudgetGroup ? 0.5 : 1,
                    cursor: !selectedBudgetGroup ? 'not-allowed' : 'pointer',
                  }}
                >
                  <option value="all">Semua Periode</option>
                  {availablePeriods.map((period) => (
                    <option key={period} value={period}>{period}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedBudgetGroup && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: '#d1ecf1',
                border: '1px solid #bee5eb',
                borderRadius: '6px',
                color: '#0c5460',
                fontSize: '14px',
              }}>
                ℹ️ Data untuk <strong>{selectedBudgetGroup}</strong> {selectedPeriod !== 'all' ? `periode ${selectedPeriod}` : '(semua periode)'} akan di-export
              </div>
            )}
          </div>

          {/* Preview Section */}
          {selectedGroupForExport && (
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              padding: '24px',
              marginBottom: '16px',
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600 }}>
                📋 Preview Data yang Akan di-Export
              </h3>

              {/* Summary Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                marginBottom: '20px',
              }}>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  borderRadius: '6px',
                }}>
                  <div style={{ fontSize: '11px', marginBottom: '6px', opacity: 0.9 }}>TOTAL BUDGET</div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>
                    Rp{formatCurrency(selectedGroupForExport.total_budget)}
                  </div>
                </div>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  borderRadius: '6px',
                }}>
                  <div style={{ fontSize: '11px', marginBottom: '6px', opacity: 0.9 }}>TOTAL REALISASI</div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>
                    Rp{formatCurrency(selectedGroupForExport.total_realisasi)}
                  </div>
                </div>
                <div style={{
                  padding: '16px',
                  backgroundColor: selectedGroupForExport.status === 'OVER_BUDGET' ? '#dc3545' : '#17a2b8',
                  color: 'white',
                  borderRadius: '6px',
                }}>
                  <div style={{ fontSize: '11px', marginBottom: '6px', opacity: 0.9 }}>VARIANCE</div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>
                    Rp{formatCurrency(Math.abs(selectedGroupForExport.total_variance))}
                  </div>
                </div>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  borderRadius: '6px',
                }}>
                  <div style={{ fontSize: '11px', marginBottom: '6px', opacity: 0.9 }}>JUMLAH AKUN</div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>
                    {selectedGroupForExport.accounts.length}
                  </div>
                </div>
              </div>

              {/* Sample Data Table */}
              <div style={{
                maxHeight: '400px',
                overflowY: 'auto',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ backgroundColor: '#f8f9fa', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>No</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Kode Akun</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Nama Akun</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>Budget</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>Realisasi</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGroupForExport.accounts.map((account, index) => (
                      <tr key={account.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                        <td style={{ padding: '10px' }}>{index + 1}</td>
                        <td style={{ padding: '10px' }}>{account.account_code}</td>
                        <td style={{ padding: '10px' }}>{account.account_name}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>Rp{formatCurrency(account.budget_allocated)}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>Rp{formatCurrency(account.realisasi)}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: account.status === 'ON_TRACK' ? '#d4edda' : '#f8d7da',
                            color: account.status === 'ON_TRACK' ? '#155724' : '#721c24',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}>
                            {account.status === 'ON_TRACK' ? 'On Track' : 'Over Budget'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Export Buttons */}
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            padding: '24px',
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600 }}>
              📤 Export Data
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '16px',
            }}>
              {/* Excel Export */}
              <div style={{
                padding: '20px',
                border: '2px solid #28a745',
                borderRadius: '8px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px',
                }}>
                  <span style={{ fontSize: '32px' }}>📊</span>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Export ke Excel</h4>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6c757d' }}>
                      Format .xlsx dengan tabel terstruktur
                    </p>
                  </div>
                </div>
                <ul style={{ fontSize: '13px', color: '#6c757d', marginBottom: '16px', paddingLeft: '20px' }}>
                  <li>Judul & metadata di atas</li>
                  <li>Ringkasan budget</li>
                  <li>Tabel detail per akun</li>
                  <li>Siap untuk analisis data</li>
                </ul>
                <button
                  onClick={exportToExcel}
                  disabled={!selectedGroupForExport || exporting}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: selectedGroupForExport && !exporting ? '#28a745' : '#adb5bd',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: selectedGroupForExport && !exporting ? 'pointer' : 'not-allowed',
                    fontWeight: 600,
                    fontSize: '14px',
                  }}
                >
                  {exporting ? '⏳ Exporting...' : '📥 Export Excel'}
                </button>
              </div>

              {/* Word Export */}
              <div style={{
                padding: '20px',
                border: '2px solid #007bff',
                borderRadius: '8px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px',
                }}>
                  <span style={{ fontSize: '32px' }}>📄</span>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Export ke Word</h4>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6c757d' }}>
                      Format .docx dengan template lengkap
                    </p>
                  </div>
                </div>
                <ul style={{ fontSize: '13px', color: '#6c757d', marginBottom: '16px', paddingLeft: '20px' }}>
                  <li>Template laporan profesional</li>
                  <li>Bagian catatan & analisis kosong</li>
                  <li>Bagian tanda tangan siap diisi</li>
                  <li>Siap untuk presentasi</li>
                </ul>
                <button
                  onClick={exportToWord}
                  disabled={!selectedGroupForExport || exporting}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: selectedGroupForExport && !exporting ? '#007bff' : '#adb5bd',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: selectedGroupForExport && !exporting ? 'pointer' : 'not-allowed',
                    fontWeight: 600,
                    fontSize: '14px',
                  }}
                >
                  {exporting ? '⏳ Exporting...' : '📥 Export Word'}
                </button>
              </div>
            </div>

            {!selectedGroupForExport && (
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '6px',
                color: '#856404',
                fontSize: '14px',
                textAlign: 'center',
              }}>
                ⚠️ Silakan pilih Budget Group terlebih dahulu untuk mengaktifkan tombol export
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ExportPage;