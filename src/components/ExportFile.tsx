//Exportfile.tsx

import React from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Document, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, Packer } from 'docx';
import type { BudgetRealization } from '../lib/accurate';

// Helper: Format currency
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('id-ID');
};

// Helper: Format date
const formatDate = (date: Date): string => {
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

interface BudgetGroup {
  budget_name: string;
  period: string;
  accounts: BudgetRealization[];
  total_budget: number;
  total_realisasi: number;
  total_variance: number;
  variance_percentage: number;
  overall_status: 'ON_TRACK' | 'OVER_BUDGET';
}

interface ExportFileProps {
  group: BudgetGroup;
  entityName: string;
  onExporting?: (isExporting: boolean) => void;
}

export const ExportFile: React.FC<ExportFileProps> = ({ group, entityName, onExporting }) => {
  const [exporting, setExporting] = React.useState(false);

  // Export to Excel
  const exportToExcel = () => {
    setExporting(true);
    onExporting?.(true);

    try {
      // Prepare header data
      const headerData = [
        ['LAPORAN BUDGET VS REALISASI'],
        [],
        ['Entitas', entityName],
        ['Nama Budget', group.budget_name],
        ['Periode', group.period],
        ['Tanggal Export', formatDate(new Date())],
        [],
        ['RINGKASAN'],
        ['Total Budget', `Rp ${formatCurrency(group.total_budget)}`],
        ['Total Realisasi', `Rp ${formatCurrency(group.total_realisasi)}`],
        ['Total Variance', `Rp ${formatCurrency(Math.abs(group.total_variance))}`],
        ['Variance %', `${Math.abs(group.variance_percentage).toFixed(2)}%`],
        ['Status', group.overall_status === 'ON_TRACK' ? 'On Track' : 'Over Budget'],
        ['Jumlah Akun', group.accounts.length],
        [],
        [],
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
        account.variance,
        `${account.variance_percentage.toFixed(2)}%`,
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
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      ];

      // Set column widths
      ws['!cols'] = [
        { wch: 5 },
        { wch: 15 },
        { wch: 40 },
        { wch: 15 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 12 },
        { wch: 15 },
      ];

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Budget Realization');

      // Save file
      const fileName = `Budget_Realization_${group.budget_name.replace(/\s+/g, '_')}_${group.period}_${new Date().getTime()}.xlsx`;
      XLSX.writeFile(wb, fileName);

      alert('✅ Export Excel berhasil!');
      console.log('[ExportFile] Excel exported:', fileName);
    } catch (err: any) {
      console.error('[ExportFile] Excel export error:', err);
      alert('❌ Gagal export Excel: ' + err.message);
    } finally {
      setExporting(false);
      onExporting?.(false);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    setExporting(true);
    onExporting?.(true);

    try {
      // Prepare CSV data
      const csvData = [
        ['LAPORAN BUDGET VS REALISASI'],
        [],
        ['Entitas', entityName],
        ['Nama Budget', group.budget_name],
        ['Periode', group.period],
        ['Tanggal Export', formatDate(new Date())],
        [],
        ['RINGKASAN'],
        ['Total Budget', `Rp ${formatCurrency(group.total_budget)}`],
        ['Total Realisasi', `Rp ${formatCurrency(group.total_realisasi)}`],
        ['Total Variance', `Rp ${formatCurrency(Math.abs(group.total_variance))}`],
        ['Variance %', `${Math.abs(group.variance_percentage).toFixed(2)}%`],
        ['Status', group.overall_status === 'ON_TRACK' ? 'On Track' : 'Over Budget'],
        ['Jumlah Akun', group.accounts.length],
        [],
        [],
        ['No', 'Kode Akun', 'Nama Akun', 'Tipe Akun', 'Budget (Rp)', 'Realisasi (Rp)', 'Variance (Rp)', 'Variance (%)', 'Status'],
        ...group.accounts.map((account, index) => [
          index + 1,
          account.account_code,
          account.account_name,
          account.account_type || '-',
          account.budget_allocated,
          account.realisasi,
          account.variance,
          `${account.variance_percentage.toFixed(2)}%`,
          account.status === 'ON_TRACK' ? 'On Track' : 'Over Budget'
        ])
      ];

      // Convert to CSV string
      const csvString = csvData.map(row => row.join(',')).join('\n');

      // Create blob and download
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const fileName = `Budget_Realization_${group.budget_name.replace(/\s+/g, '_')}_${group.period}_${new Date().getTime()}.csv`;
      saveAs(blob, fileName);

      alert('✅ Export CSV berhasil!');
      console.log('[ExportFile] CSV exported:', fileName);
    } catch (err: any) {
      console.error('[ExportFile] CSV export error:', err);
      alert('❌ Gagal export CSV: ' + err.message);
    } finally {
      setExporting(false);
      onExporting?.(false);
    }
  };

  // Export to Word
  const exportToWord = async () => {
    setExporting(true);
    onExporting?.(true);

    try {
      // Create document
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
                      children: [new Paragraph(entityName)],
                      width: { size: 70, type: WidthType.PERCENTAGE },
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Nama Budget')] }),
                    new TableCell({ children: [new Paragraph(group.budget_name)] }),
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
                    new TableCell({ children: [new Paragraph(group.overall_status === 'ON_TRACK' ? 'On Track' : 'Over Budget')] }),
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

            // Catatan Section
            new Paragraph({
              text: 'Catatan & Analisis',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 200 },
            }),
            new Paragraph({ text: '(Isi catatan dan analisis di sini)' }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: '' }),

            new Paragraph({ text: '', spacing: { before: 300 } }),

            // Tanda Tangan Section
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
      const fileName = `Budget_Realization_${group.budget_name.replace(/\s+/g, '_')}_${group.period}_${new Date().getTime()}.docx`;
      saveAs(blob, fileName);

      alert('✅ Export Word berhasil!');
      console.log('[ExportFile] Word exported:', fileName);
    } catch (err: any) {
      console.error('[ExportFile] Word export error:', err);
      alert('❌ Gagal export Word: ' + err.message);
    } finally {
      setExporting(false);
      onExporting?.(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
    }}>
      {/* Excel Button */}
      <button
        onClick={exportToExcel}
        disabled={exporting}
        style={{
          padding: '8px 16px',
          backgroundColor: exporting ? '#6c757d' : '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: exporting ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        📊 Export Excel
      </button>

      {/* CSV Button */}
      <button
        onClick={exportToCSV}
        disabled={exporting}
        style={{
          padding: '8px 16px',
          backgroundColor: exporting ? '#6c757d' : '#17a2b8',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: exporting ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        📄 Export CSV
      </button>

      {/* Word Button */}
      <button
        onClick={exportToWord}
        disabled={exporting}
        style={{
          padding: '8px 16px',
          backgroundColor: exporting ? '#6c757d' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: exporting ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        📝 Export Word
      </button>
    </div>
  );
};