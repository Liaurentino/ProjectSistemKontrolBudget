import React from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  Document,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  Packer,
  TextRun,
  BorderStyle,
  ShadingType,
  VerticalAlign,
} from 'docx';
import type { BudgetRealization } from '../../lib/accurate';
import styles from './ExportFile.module.css';

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
    minute: '2-digit',
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

  // ========================================
  // EXPORT TO EXCEL (WITH STYLING)
  // ========================================
  const exportToExcel = () => {
    setExporting(true);
    onExporting?.(true);

    try {
      // ========================================
      // PREPARE DATA
      // ========================================
      const data: any[][] = [];

      // Title (Row 1)
      data.push(['LAPORAN BUDGET VS REALISASI']);
      data.push([]); // Empty row

      // Header Info (Row 3-6)
      data.push(['Entitas:', entityName]);
      data.push(['Nama Budget:', group.budget_name]);
      data.push(['Periode:', group.period]);
      data.push(['Tanggal Export:', formatDate(new Date())]);
      data.push([]); // Empty row

      // Table Header (Row 8)
      data.push([
        'No',
        'Kode Akun',
        'Nama Akun',
        'Tipe Akun',
        'Budget (Rp)',
        'Realisasi (Rp)',
        'Variance (Rp)',
        'Variance (%)',
        'Status',
      ]);

      // Table Data
      group.accounts.forEach((account, index) => {
        data.push([
          index + 1,
          account.account_code,
          account.account_name,
          account.account_type || '-',
          account.budget_allocated,
          account.realisasi,
          account.variance,
          account.variance_percentage.toFixed(2),
          account.status === 'ON_TRACK' ? 'On Track' : 'Over Budget',
        ]);
      });

      // Total Row
      const totalRowIndex = data.length;
      data.push([
        'TOTAL',
        '',
        '',
        '',
        group.total_budget,
        group.total_realisasi,
        group.total_variance,
        group.variance_percentage.toFixed(2),
        group.overall_status === 'ON_TRACK' ? 'On Track' : 'Over Budget',
      ]);

      // ========================================
      // CREATE WORKSHEET
      // ========================================
      const ws = XLSX.utils.aoa_to_sheet(data);

      // ========================================
      // MERGE CELLS
      // ========================================
      ws['!merges'] = [
        // Title (merge A1:I1)
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
        
        // Total row - merge "TOTAL" across first 4 columns
        { s: { r: totalRowIndex, c: 0 }, e: { r: totalRowIndex, c: 3 } },
      ];

      // ========================================
      // COLUMN WIDTHS
      // ========================================
      ws['!cols'] = [
        { wch: 5 },   // No
        { wch: 15 },  // Kode Akun
        { wch: 35 },  // Nama Akun
        { wch: 12 },  // Tipe
        { wch: 18 },  // Budget
        { wch: 18 },  // Realisasi
        { wch: 18 },  // Variance
        { wch: 12 },  // Variance %
        { wch: 15 },  // Status
      ];

      // ========================================
      // STYLING
      // ========================================
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellAddress]) continue;

          // Initialize cell style
          if (!ws[cellAddress].s) ws[cellAddress].s = {};

          // ========================================
          // ROW 1: TITLE
          // ========================================
          if (R === 0) {
            ws[cellAddress].s = {
              font: { bold: true, sz: 14, name: 'Calibri' },
              alignment: { horizontal: 'center', vertical: 'center' },
              fill: { fgColor: { rgb: '4472C4' } },
              border: {
                top: { style: 'thin', color: { rgb: '000000' } },
                bottom: { style: 'thin', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } },
              },
            };
          }

          // ========================================
          // ROW 3-6: HEADER INFO (Bold keys)
          // ========================================
          if (R >= 2 && R <= 5 && C === 0) {
            ws[cellAddress].s = {
              font: { bold: true, sz: 11, name: 'Calibri' },
              alignment: { horizontal: 'left', vertical: 'center' },
            };
          }

          // ========================================
          // ROW 8: TABLE HEADER
          // ========================================
          if (R === 7) {
            ws[cellAddress].s = {
              font: { bold: true, sz: 11, name: 'Calibri', color: { rgb: 'FFFFFF' } },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
              fill: { fgColor: { rgb: '808080' } }, // Gray background
              border: {
                top: { style: 'thin', color: { rgb: '000000' } },
                bottom: { style: 'thin', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } },
              },
            };
          }

          // ========================================
          // DATA ROWS (R >= 8)
          // ========================================
          if (R >= 8 && R < totalRowIndex) {
            // Alignment
            let alignment: any = { vertical: 'center' };
            
            if (C === 0 || C === 8) {
              // No & Status - center
              alignment.horizontal = 'center';
            } else if (C >= 4 && C <= 7) {
              // Numbers - right
              alignment.horizontal = 'right';
            } else {
              // Text - left
              alignment.horizontal = 'left';
            }

            ws[cellAddress].s = {
              font: { sz: 11, name: 'Calibri' },
              alignment: alignment,
              border: {
                top: { style: 'thin', color: { rgb: 'D9D9D9' } },
                bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
                left: { style: 'thin', color: { rgb: 'D9D9D9' } },
                right: { style: 'thin', color: { rgb: 'D9D9D9' } },
              },
            };

            // Number format for currency columns (E, F, G)
            if (C >= 4 && C <= 6) {
              ws[cellAddress].z = '#,##0';
            }
          }

          // ========================================
          // TOTAL ROW
          // ========================================
          if (R === totalRowIndex) {
            let alignment: any = { vertical: 'center' };
            
            if (C <= 3) {
              // "TOTAL" text - right aligned
              alignment.horizontal = 'right';
            } else if (C >= 4 && C <= 7) {
              // Numbers - right
              alignment.horizontal = 'right';
            } else {
              // Status - center
              alignment.horizontal = 'center';
            }

            ws[cellAddress].s = {
              font: { bold: true, sz: 11, name: 'Calibri' },
              alignment: alignment,
              fill: { fgColor: { rgb: 'F2F2F2' } }, // Light gray
              border: {
                top: { style: 'medium', color: { rgb: '000000' } },
                bottom: { style: 'medium', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } },
              },
            };

            // Number format for currency
            if (C >= 4 && C <= 6) {
              ws[cellAddress].z = '#,##0';
            }
          }
        }
      }

      // ========================================
      // ROW HEIGHT
      // ========================================
      ws['!rows'] = [];
      ws['!rows'][0] = { hpt: 30 }; // Title row height
      ws['!rows'][7] = { hpt: 30 }; // Header row height

      // ========================================
      // CREATE WORKBOOK & SAVE
      // ========================================
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Budget Realization');

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

  // ========================================
  // EXPORT TO CSV (FORMATTED)
  // ========================================
  const exportToCSV = () => {
    setExporting(true);
    onExporting?.(true);

    try {
      const csvData: string[][] = [];

      // Title
      csvData.push(['LAPORAN BUDGET VS REALISASI']);
      csvData.push([]);

      // Header Info
      csvData.push(['Entitas:', entityName]);
      csvData.push(['Nama Budget:', group.budget_name]);
      csvData.push(['Periode:', group.period]);
      csvData.push(['Tanggal Export:', formatDate(new Date())]);
      csvData.push([]);

      // Table Header with separator line
      csvData.push(['='.repeat(100)]); // Visual separator
      csvData.push([
        'No',
        'Kode Akun',
        'Nama Akun',
        'Tipe Akun',
        'Budget (Rp)',
        'Realisasi (Rp)',
        'Variance (Rp)',
        'Variance (%)',
        'Status',
      ]);
      csvData.push(['='.repeat(100)]); // Visual separator

      // Table Data
      group.accounts.forEach((account, index) => {
        csvData.push([
          (index + 1).toString(),
          account.account_code,
          account.account_name,
          account.account_type || '-',
          formatCurrency(account.budget_allocated),
          formatCurrency(account.realisasi),
          formatCurrency(account.variance),
          account.variance_percentage.toFixed(2) + '%',
          account.status === 'ON_TRACK' ? 'On Track' : 'Over Budget',
        ]);
      });

      // Separator before total
      csvData.push(['='.repeat(100)]);

      // Total Row
      csvData.push([
        'TOTAL',
        '',
        '',
        '',
        formatCurrency(group.total_budget),
        formatCurrency(group.total_realisasi),
        formatCurrency(group.total_variance),
        group.variance_percentage.toFixed(2) + '%',
        group.overall_status === 'ON_TRACK' ? 'On Track' : 'Over Budget',
      ]);

      csvData.push(['='.repeat(100)]);

      // Convert to CSV string with proper escaping
      const csvString = csvData
        .map(row =>
          row
            .map(cell => {
              // Escape quotes and wrap in quotes if contains comma
              const escaped = cell.replace(/"/g, '""');
              return cell.includes(',') || cell.includes('"') || cell.includes('\n')
                ? `"${escaped}"`
                : escaped;
            })
            .join(',')
        )
        .join('\n');

      // Add BOM for proper Excel UTF-8 encoding
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
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

  // ========================================
  // EXPORT TO WORD (UNCHANGED)
  // ========================================
  const exportToWord = async () => {
    setExporting(true);
    onExporting?.(true);

    try {
      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: 720,    // 0.5 inch
                  right: 720,
                  bottom: 720,
                  left: 720,
                },
              },
            },
            children: [
              // ========================================
              // TITLE
              // ========================================
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'LAPORAN BUDGET VS REALISASI',
                    bold: true,
                    size: 28, // 14pt
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
              }),

              // ========================================
              // HEADER INFO (Entitas, Budget, Periode, Tanggal)
              // ========================================
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                },
                rows: [
                  // Row 1: Entitas
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: 'Entitas:', bold: true })],
                          }),
                        ],
                        width: { size: 20, type: WidthType.PERCENTAGE },
                      }),
                      new TableCell({
                        children: [new Paragraph(entityName)],
                        width: { size: 80, type: WidthType.PERCENTAGE },
                      }),
                    ],
                  }),

                  // Row 2: Nama Budget
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: 'Nama Budget:', bold: true })],
                          }),
                        ],
                      }),
                      new TableCell({
                        children: [new Paragraph(group.budget_name)],
                      }),
                    ],
                  }),

                  // Row 3: Periode
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: 'Periode:', bold: true })],
                          }),
                        ],
                      }),
                      new TableCell({
                        children: [new Paragraph(group.period)],
                      }),
                    ],
                  }),

                  // Row 4: Tanggal Export
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: 'Tanggal Export:', bold: true })],
                          }),
                        ],
                      }),
                      new TableCell({
                        children: [new Paragraph(formatDate(new Date()))],
                      }),
                    ],
                  }),
                ],
              }),

              // Spacing
              new Paragraph({ text: '', spacing: { before: 400, after: 200 } }),

              // ========================================
              // MAIN TABLE (Accounting Spreadsheet Style)
              // ========================================
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  // ========================================
                  // TABLE HEADER
                  // ========================================
                  new TableRow({
                    tableHeader: true,
                    children: [
                      // No
                      new TableCell({
                        shading: { fill: 'D9D9D9', type: ShadingType.CLEAR },
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: 'No', bold: true })],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                        width: { size: 5, type: WidthType.PERCENTAGE },
                      }),

                      // Kode Akun
                      new TableCell({
                        shading: { fill: 'D9D9D9', type: ShadingType.CLEAR },
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: 'Kode Akun', bold: true })],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                        width: { size: 12, type: WidthType.PERCENTAGE },
                      }),

                      // Nama Akun
                      new TableCell({
                        shading: { fill: 'D9D9D9', type: ShadingType.CLEAR },
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: 'Nama Akun', bold: true })],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                        width: { size: 23, type: WidthType.PERCENTAGE },
                      }),

                      // Tipe Akun
                      new TableCell({
                        shading: { fill: 'D9D9D9', type: ShadingType.CLEAR },
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: 'Tipe', bold: true })],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                        width: { size: 10, type: WidthType.PERCENTAGE },
                      }),

                      // Budget (Rp)
                      new TableCell({
                        shading: { fill: 'D9D9D9', type: ShadingType.CLEAR },
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: 'Budget (Rp)', bold: true })],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                        width: { size: 12, type: WidthType.PERCENTAGE },
                      }),

                      // Realisasi (Rp)
                      new TableCell({
                        shading: { fill: 'D9D9D9', type: ShadingType.CLEAR },
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: 'Realisasi (Rp)', bold: true })],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                        width: { size: 12, type: WidthType.PERCENTAGE },
                      }),

                      // Variance (Rp)
                      new TableCell({
                        shading: { fill: 'D9D9D9', type: ShadingType.CLEAR },
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: 'Variance (Rp)', bold: true })],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                        width: { size: 12, type: WidthType.PERCENTAGE },
                      }),

                      // Variance (%)
                      new TableCell({
                        shading: { fill: 'D9D9D9', type: ShadingType.CLEAR },
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: 'Variance (%)', bold: true })],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                        width: { size: 10, type: WidthType.PERCENTAGE },
                      }),

                      // Status
                      new TableCell({
                        shading: { fill: 'D9D9D9', type: ShadingType.CLEAR },
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: 'Status', bold: true })],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                        width: { size: 12, type: WidthType.PERCENTAGE },
                      }),
                    ],
                  }),

                  // ========================================
                  // TABLE DATA ROWS
                  // ========================================
                  ...group.accounts.map((account, index) =>
                    new TableRow({
                      children: [
                        // No
                        new TableCell({
                          children: [
                            new Paragraph({
                              text: (index + 1).toString(),
                              alignment: AlignmentType.CENTER,
                            }),
                          ],
                        }),

                        // Kode Akun
                        new TableCell({
                          children: [
                            new Paragraph({
                              text: account.account_code,
                              alignment: AlignmentType.LEFT,
                            }),
                          ],
                        }),

                        // Nama Akun
                        new TableCell({
                          children: [
                            new Paragraph({
                              text: account.account_name,
                              alignment: AlignmentType.LEFT,
                            }),
                          ],
                        }),

                        // Tipe Akun
                        new TableCell({
                          children: [
                            new Paragraph({
                              text: account.account_type || '-',
                              alignment: AlignmentType.LEFT,
                            }),
                          ],
                        }),

                        // Budget (Rp)
                        new TableCell({
                          children: [
                            new Paragraph({
                              text: formatCurrency(account.budget_allocated),
                              alignment: AlignmentType.RIGHT,
                            }),
                          ],
                        }),

                        // Realisasi (Rp)
                        new TableCell({
                          children: [
                            new Paragraph({
                              text: formatCurrency(account.realisasi),
                              alignment: AlignmentType.RIGHT,
                            }),
                          ],
                        }),

                        // Variance (Rp)
                        new TableCell({
                          children: [
                            new Paragraph({
                              text: formatCurrency(Math.abs(account.variance)),
                              alignment: AlignmentType.RIGHT,
                            }),
                          ],
                        }),

                        // Variance (%)
                        new TableCell({
                          children: [
                            new Paragraph({
                              text: `${Math.abs(account.variance_percentage).toFixed(2)}%`,
                              alignment: AlignmentType.RIGHT,
                            }),
                          ],
                        }),

                        // Status
                        new TableCell({
                          children: [
                            new Paragraph({
                              text: account.status === 'ON_TRACK' ? 'On Track' : 'Over Budget',
                              alignment: AlignmentType.CENTER,
                            }),
                          ],
                        }),
                      ],
                    })
                  ),

                  // ========================================
                  // TOTAL ROW
                  // ========================================
                  new TableRow({
                    children: [
                      // TOTAL (merged cells)
                      new TableCell({
                        shading: { fill: 'F2F2F2', type: ShadingType.CLEAR },
                        columnSpan: 4,
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: 'TOTAL', bold: true })],
                            alignment: AlignmentType.RIGHT,
                          }),
                        ],
                      }),

                      // Total Budget
                      new TableCell({
                        shading: { fill: 'F2F2F2', type: ShadingType.CLEAR },
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: formatCurrency(group.total_budget), bold: true })],
                            alignment: AlignmentType.RIGHT,
                          }),
                        ],
                      }),

                      // Total Realisasi
                      new TableCell({
                        shading: { fill: 'F2F2F2', type: ShadingType.CLEAR },
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: formatCurrency(group.total_realisasi), bold: true })],
                            alignment: AlignmentType.RIGHT,
                          }),
                        ],
                      }),

                      // Total Variance
                      new TableCell({
                        shading: { fill: 'F2F2F2', type: ShadingType.CLEAR },
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: formatCurrency(Math.abs(group.total_variance)), bold: true })],
                            alignment: AlignmentType.RIGHT,
                          }),
                        ],
                      }),

                      // Total Variance %
                      new TableCell({
                        shading: { fill: 'F2F2F2', type: ShadingType.CLEAR },
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: `${Math.abs(group.variance_percentage).toFixed(2)}%`, bold: true })],
                            alignment: AlignmentType.RIGHT,
                          }),
                        ],
                      }),

                      // Overall Status
                      new TableCell({
                        shading: { fill: 'F2F2F2', type: ShadingType.CLEAR },
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: group.overall_status === 'ON_TRACK' ? 'On Track' : 'Over Budget', bold: true })],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          },
        ],
      });

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
    <div className={styles.exportContainer}>
      <button
        onClick={exportToExcel}
        disabled={exporting}
        className={`${styles.exportButton} ${styles.excelButton}`}
      >
        {exporting ? 'Exporting...' : 'Export Excel'}
      </button>

      <button
        onClick={exportToCSV}
        disabled={exporting}
        className={`${styles.exportButton} ${styles.csvButton}`}
      >
        {exporting ? 'Exporting...' : 'Export CSV'}
      </button>

      <button
        onClick={exportToWord}
        disabled={exporting}
        className={`${styles.exportButton} ${styles.wordButton}`}
      >
        {exporting ? 'Exporting...' : 'Export Word'}
      </button>
    </div>
  );
};

export default ExportFile;