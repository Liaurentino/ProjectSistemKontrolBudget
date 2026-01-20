import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { importCoaFromExcel } from '../lib/supabase';

interface ImportExcelProps {
  entityId: number;
  onSuccess: () => void;
  onError: (message: string) => void;
  onClose: () => void;
}

export const ImportExcel: React.FC<ImportExcelProps> = ({ 
  entityId, 
  onSuccess, 
  onError,
  onClose 
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<'standard' | 'unknown'>('unknown');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const fileName = droppedFile.name.toLowerCase();
      
      // Accept semua format Excel
      if (fileName.endsWith('.xlsx') || 
          fileName.endsWith('.xls') || 
          fileName.endsWith('.xlsm') || 
          fileName.endsWith('.xlsb') ||
          droppedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          droppedFile.type === 'application/vnd.ms-excel') {
        handleFileSelection(droppedFile);
      } else {
        onError('File harus berformat Excel (.xlsx, .xls, .xlsm, .xlsb)');
      }
    }
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  // Detect Excel format and preview
  const handleFileSelection = async (selectedFile: File) => {
    setFile(selectedFile);
    
    try {
      // Read Excel file
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Read WITHOUT header to get raw data
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      console.log('[ImportExcel] Raw data rows:', rawData.length);
      console.log('[ImportExcel] First 5 rows:', rawData.slice(0, 5));

      if (!rawData || rawData.length === 0) {
        setDetectedFormat('unknown');
        setPreviewData([]);
        return;
      }

      // FIND HEADER ROW - Cari baris yang punya "Account No" atau "Account Name"
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(20, rawData.length); i++) {
        const row = rawData[i];
        if (!row || !Array.isArray(row)) continue;
        
        const rowStr = row.join('|').toLowerCase();
        
        if (rowStr.includes('account') && (
            rowStr.includes('no') || 
            rowStr.includes('name') || 
            rowStr.includes('code')
        )) {
          headerRowIndex = i;
          console.log('[ImportExcel] Found header at row:', i, row);
          break;
        }
      }

      if (headerRowIndex === -1) {
        console.log('[ImportExcel] No header row found, treating row 0 as header');
        headerRowIndex = 0;
      }

      // Parse data starting from header row
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      range.s.r = headerRowIndex; // Start from header row
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        range: headerRowIndex,
        defval: '' 
      });

      console.log('[ImportExcel] Parsed data:', jsonData.length, 'rows');

      if (!Array.isArray(jsonData) || jsonData.length === 0) {
        setDetectedFormat('unknown');
        setPreviewData([]);
        return;
      }

      // Get column names from first row
      const firstRow = jsonData[0] as any;
      const columns = Object.keys(firstRow).map(c => c.toLowerCase().trim());

      console.log('[ImportExcel] Available columns:', columns);

      // FLEXIBLE DETECTION - Cari kolom yang mirip
      const hasAccountCode = columns.some(col => 
        col.includes('account') && (col.includes('code') || col.includes('no') || col.includes('number')) ||
        col === 'kode' ||
        col === 'code' ||
        col === 'no' ||
        col.includes('kode akun') ||
        col.includes('nomor')
      );

      const hasAccountName = columns.some(col => 
        col.includes('account') && col.includes('name') ||
        col.includes('nama') ||
        col === 'name' ||
        col === 'account' ||
        col.includes('uraian') ||
        col.includes('keterangan')
      );

      // Jika punya minimal account code DAN account name, dianggap VALID
      const format = (hasAccountCode && hasAccountName) ? 'standard' : 'unknown';

      setDetectedFormat(format);
      setPreviewData(jsonData.slice(0, 5)); // Show first 5 rows as preview

      console.log('[ImportExcel] Detected format:', format);
      console.log('[ImportExcel] Has account code:', hasAccountCode);
      console.log('[ImportExcel] Has account name:', hasAccountName);

    } catch (err) {
      console.error('[ImportExcel] Error reading file:', err);
      setDetectedFormat('unknown');
      setPreviewData([]);
    }
  };

  // Helper: Find column value with flexible matching
  const findColumnValue = (row: any, possibleNames: string[]): any => {
    // Normalize row keys
    const normalizedRow: any = {};
    Object.keys(row).forEach(key => {
      normalizedRow[key.toLowerCase().trim()] = row[key];
    });

    // Try to find matching column
    for (const name of possibleNames) {
      const normalized = name.toLowerCase().trim();
      
      // Exact match
      if (normalizedRow[normalized] !== undefined) {
        return normalizedRow[normalized];
      }
      
      // Partial match (contains)
      const matchingKey = Object.keys(normalizedRow).find(key => 
        key.includes(normalized) || normalized.includes(key)
      );
      
      if (matchingKey && normalizedRow[matchingKey] !== undefined) {
        return normalizedRow[matchingKey];
      }
    }
    
    return null;
  };

  // Transform data based on detected format
  const transformData = (jsonData: any[]) => {
    if (detectedFormat === 'standard') {
      return jsonData.map((row: any) => {
        // FLEXIBLE COLUMN MAPPING
        const accountCode = findColumnValue(row, [
          'account no', 'account_no', 'accountno',
          'account_code', 'account code', 'account number',
          'kode', 'kode akun', 'nomor akun', 'no akun', 'code', 'no'
        ]);

        const accountName = findColumnValue(row, [
          'account name', 'account_name', 'accountname',
          'account', 'nama', 'nama akun', 'uraian', 'keterangan', 'name', 'description'
        ]);

        const accountType = findColumnValue(row, [
          'account_type', 'account type', 'type',
          'tipe', 'tipe akun', 'jenis', 'kategori'
        ]);

        // BALANCE - Prioritas: Ending Balance > Balance > Saldo
        const balance = findColumnValue(row, [
          'ending balance', 'ending_balance', 'endingbalance', 'final balance',
          'balance', 'saldo', 'saldo akhir', 'amount', 'nilai', 'jumlah'
        ]);

        const currency = findColumnValue(row, [
          'currency', 'mata uang', 'curr'
        ]);

        const suspended = findColumnValue(row, [
          'suspended', 'status', 'aktif', 'active'
        ]);

        const lvl = findColumnValue(row, [
          'lvl', 'level', 'tingkat', 'hierarchy'
        ]);

        // Db/Cr untuk auto-detect account type
        const dbCr = findColumnValue(row, [
          'db/cr', 'dbcr', 'db cr', 'debit/credit', 'type'
        ]);

        // SKIP empty rows
        if (!accountCode && !accountName) return null;

        // SKIP total/subtotal/difference rows
        const codeStr = String(accountCode || '').toLowerCase().trim();
        const nameStr = String(accountName || '').toLowerCase().trim();
        
        const skipKeywords = ['total', 'subtotal', 'difference', 'grand total', 'sub total'];
        const shouldSkip = skipKeywords.some(keyword => 
          codeStr.includes(keyword) || nameStr.includes(keyword)
        );
        
        if (shouldSkip) {
          console.log('[transformData] Skipping total/summary row:', accountCode, accountName);
          return null;
        }

        // Auto-detect account type from code or Db/Cr
        let finalAccountType = 'ASSET'; // default
        
        if (accountType) {
          finalAccountType = String(accountType).toUpperCase().trim();
        } else {
          const code = String(accountCode || '');
          
          // Detect from account code
          if (code.startsWith('1')) finalAccountType = 'ASSET';
          else if (code.startsWith('2')) finalAccountType = 'LIABILITY';
          else if (code.startsWith('3')) finalAccountType = 'EQUITY';
          else if (code.startsWith('4')) finalAccountType = 'REVENUE';
          else if (code.startsWith('5')) finalAccountType = 'EXPENSE';
          
          // Override with Db/Cr if available
          if (dbCr) {
            const dbCrStr = String(dbCr).toUpperCase().trim();
            if (dbCrStr.includes('CR') || dbCrStr.includes('CREDIT')) {
              // Credit balance biasanya LIABILITY, EQUITY, atau REVENUE
              if (code.startsWith('2')) finalAccountType = 'LIABILITY';
              else if (code.startsWith('3')) finalAccountType = 'EQUITY';
              else if (code.startsWith('4')) finalAccountType = 'REVENUE';
            } else if (dbCrStr.includes('DB') || dbCrStr.includes('DEBIT')) {
              // Debit balance biasanya ASSET atau EXPENSE
              if (code.startsWith('1')) finalAccountType = 'ASSET';
              else if (code.startsWith('5')) finalAccountType = 'EXPENSE';
            }
          }
        }

        return {
          entity_id: entityId,
          account_code: String(accountCode || '').trim(),
          account_name: String(accountName || '').trim(),
          account_type: finalAccountType,
          balance: Number(balance || 0),
          currency: String(currency || 'IDR').toUpperCase(),
          suspended: suspended === true || suspended === 'true' || suspended === 1 || suspended === 'suspended',
          source_type: 'excel',
          source_id: null,
          parent_id: null,
          lvl: Number(lvl || 1),
        };
      }).filter(Boolean); // Remove null entries
    }

    return [];
  };

  // Handle import
  const handleImport = async () => {
    if (!file) {
      onError('Pilih file Excel terlebih dahulu');
      return;
    }

    if (detectedFormat === 'unknown') {
      onError('Format Excel tidak dikenali. Pastikan file memiliki kolom yang sesuai.');
      return;
    }

    setImporting(true);

    try {
      // Read Excel file
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Read raw data to find header
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // FIND HEADER ROW
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(20, rawData.length); i++) {
        const row = rawData[i];
        if (!row || !Array.isArray(row)) continue;
        
        const rowStr = row.join('|').toLowerCase();
        
        if (rowStr.includes('account') && (
            rowStr.includes('no') || 
            rowStr.includes('name') || 
            rowStr.includes('code')
        )) {
          headerRowIndex = i;
          break;
        }
      }

      console.log('[ImportExcel] Using header row index:', headerRowIndex);

      // Parse from header row
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      range.s.r = headerRowIndex;
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        range: headerRowIndex,
        defval: '' 
      });

      console.log('[ImportExcel] Raw data:', jsonData);

      // Transform data based on format
      const accounts = transformData(jsonData);

      console.log('[ImportExcel] Transformed accounts:', accounts);

      if (accounts.length === 0) {
        throw new Error('Tidak ada data valid yang ditemukan di file Excel');
      }

      // Import menggunakan fungsi dari supabase.ts
      const { data: result, error: importError } = await importCoaFromExcel(accounts);
      
      if (importError) {
        throw new Error(importError);
      }

      onSuccess();
      alert(`✅ Berhasil import ${result?.count || accounts.length} akun dari Excel!`);
    } catch (err: any) {
      console.error('[ImportExcel] Error:', err);
      onError('Gagal import Excel: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '700px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600 }}>
            Import Chart of Accounts
          </h2>
          <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
            Upload file Excel (.xlsx, .xls, .xlsm, .xlsb) untuk import data COA
          </p>
        </div>

        {/* Drag & Drop Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? '#007bff' : '#dee2e6'}`,
            borderRadius: '8px',
            padding: '48px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: dragActive ? '#e7f3ff' : '#f8f9fa',
            transition: 'all 0.3s',
            marginBottom: '24px',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.xlsm,.xlsb,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            📊
          </div>
          
          {file ? (
            <>
              <p style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 500, color: '#28a745' }}>
                ✓ File dipilih
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: '#6c757d' }}>
                {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setDetectedFormat('unknown');
                  setPreviewData([]);
                }}
                style={{
                  marginTop: '12px',
                  padding: '6px 12px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Hapus File
              </button>
            </>
          ) : (
            <>
              <p style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 500 }}>
                {dragActive ? 'Drop file di sini' : 'Drag & drop file Excel'}
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: '#6c757d' }}>
                atau klik untuk pilih file dari komputer
              </p>
            </>
          )}
        </div>

        {/* Detected Format */}
        {file && detectedFormat !== 'unknown' && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '6px',
            marginBottom: '16px',
          }}>
            <div style={{ fontSize: '14px', color: '#155724', fontWeight: 600 }}>
              ✓ Format Terdeteksi: Format Standard
            </div>
          </div>
        )}

        {file && detectedFormat === 'unknown' && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '6px',
            marginBottom: '16px',
          }}>
            <div style={{ fontSize: '14px', color: '#856404', fontWeight: 600 }}>
              ⚠ Format tidak dikenali. Pastikan file memiliki kolom yang sesuai.
            </div>
          </div>
        )}

        {/* Preview Data */}
        {previewData.length > 0 && (
          <div style={{
            marginBottom: '24px',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#f8f9fa',
              borderBottom: '1px solid #dee2e6',
              fontWeight: 600,
              fontSize: '14px',
            }}>
              Preview Data (5 baris pertama)
            </div>
            <div style={{ overflowX: 'auto', maxHeight: '200px' }}>
              <table style={{
                width: '100%',
                fontSize: '12px',
                borderCollapse: 'collapse',
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{
                      padding: '8px',
                      textAlign: 'left',
                      borderBottom: '1px solid #dee2e6',
                      fontWeight: 600,
                    }}>
                      Kode Akun
                    </th>
                    <th style={{
                      padding: '8px',
                      textAlign: 'left',
                      borderBottom: '1px solid #dee2e6',
                      fontWeight: 600,
                    }}>
                      Nama Akun
                    </th>
                    <th style={{
                      padding: '8px',
                      textAlign: 'left',
                      borderBottom: '1px solid #dee2e6',
                      fontWeight: 600,
                    }}>
                      Tipe
                    </th>
                    <th style={{
                      padding: '8px',
                      textAlign: 'right',
                      borderBottom: '1px solid #dee2e6',
                      fontWeight: 600,
                    }}>
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, idx) => {
                    // Extract values with flexible matching
                    const findValue = (possibleNames: string[]): any => {
                      const normalizedRow: any = {};
                      Object.keys(row).forEach(key => {
                        normalizedRow[key.toLowerCase().trim()] = row[key];
                      });

                      for (const name of possibleNames) {
                        const normalized = name.toLowerCase().trim();
                        if (normalizedRow[normalized] !== undefined) {
                          return normalizedRow[normalized];
                        }
                        const matchingKey = Object.keys(normalizedRow).find(key => 
                          key.includes(normalized) || normalized.includes(key)
                        );
                        if (matchingKey && normalizedRow[matchingKey] !== undefined) {
                          return normalizedRow[matchingKey];
                        }
                      }
                      return null;
                    };

                    const accountCode = findValue([
                      'account no', 'account_no', 'accountno',
                      'account_code', 'account code', 'kode', 'code', 'no'
                    ]);

                    const accountName = findValue([
                      'account name', 'account_name', 'accountname',
                      'account', 'nama', 'name'
                    ]);

                    const balance = findValue([
                      'ending balance', 'ending_balance', 'balance', 'saldo'
                    ]);

                    // Skip if no code and name
                    if (!accountCode && !accountName) return null;

                    // Detect account type from code
                    let accountType = 'ASSET';
                    const code = String(accountCode || '');
                    if (code.startsWith('1')) accountType = 'ASSET';
                    else if (code.startsWith('2')) accountType = 'LIABILITY';
                    else if (code.startsWith('3')) accountType = 'EQUITY';
                    else if (code.startsWith('4')) accountType = 'REVENUE';
                    else if (code.startsWith('5')) accountType = 'EXPENSE';

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
                          {String(accountCode || '-')}
                        </td>
                        <td style={{ padding: '8px', fontSize: '11px' }}>
                          {String(accountName || '-')}
                        </td>
                        <td style={{ padding: '8px', fontSize: '11px' }}>
                          <span style={{
                            padding: '2px 6px',
                            backgroundColor: '#e7f3ff',
                            color: '#004085',
                            borderRadius: '3px',
                            fontSize: '10px',
                          }}>
                            {accountType}
                          </span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', fontSize: '11px' }}>
                          {balance ? Number(balance).toLocaleString('id-ID') : '0'}
                        </td>
                      </tr>
                    );
                  }).filter(Boolean)}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Format Info */}
        <div style={{
          padding: '16px',
          backgroundColor: '#e7f3ff',
          borderRadius: '6px',
          marginBottom: '24px',
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600, color: '#004085' }}>
            📋 Format Excel yang Didukung:
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#004085', lineHeight: '1.8' }}>
            <li>
              <strong>Kolom Wajib:</strong> Kode Akun & Nama Akun (dengan nama apapun)
            </li>
            <li>
              <strong>Kolom Opsional:</strong> Tipe/Jenis, Saldo/Balance, Currency, Level
            </li>
            <li>
              <strong>Nama Kolom Fleksibel:</strong> Sistem akan mendeteksi otomatis meski nama beda
            </li>
            <li>
              Contoh: "Kode", "Account Code", "Nomor Akun" → semua akan terbaca sebagai Kode Akun
            </li>
            <li>File harus dalam format Excel (.xlsx, .xls, .xlsm, .xlsb)</li>
          </ul>
        </div>

        {/* Download Template */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <button
            onClick={() => {
              // Create sample Excel template - STANDARD FORMAT
              const sampleData = [
                ['account_code', 'account_name', 'account_type', 'balance', 'currency', 'suspended', 'lvl'],
                ['1-0000', 'ASET', 'ASSET', 0, 'IDR', false, 1],
                ['1-1000', 'Aset Lancar', 'ASSET', 0, 'IDR', false, 2],
                ['1-1100', 'Kas & Bank', 'ASSET', 5000000, 'IDR', false, 3],
                ['2-0000', 'LIABILITAS', 'LIABILITY', 0, 'IDR', false, 1],
                ['3-0000', 'EKUITAS', 'EQUITY', 0, 'IDR', false, 1],
              ];
              
              const ws = XLSX.utils.aoa_to_sheet(sampleData);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, 'COA Template');
              XLSX.writeFile(wb, 'COA_Template_Standard.xlsx');
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            📥 Download Template Standard
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleImport}
            disabled={!file || importing || detectedFormat === 'unknown'}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: !file || importing || detectedFormat === 'unknown' ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: !file || importing || detectedFormat === 'unknown' ? 'not-allowed' : 'pointer',
              fontSize: '15px',
              fontWeight: 600,
              opacity: !file || importing || detectedFormat === 'unknown' ? 0.6 : 1,
            }}
          >
            {importing ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                {' '}Importing...
              </>
            ) : (
              '📥 Import Sekarang'
            )}
          </button>
          
          <button
            onClick={onClose}
            disabled={importing}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: 'white',
              color: '#6c757d',
              border: '2px solid #dee2e6',
              borderRadius: '6px',
              cursor: importing ? 'not-allowed' : 'pointer',
              fontSize: '15px',
              fontWeight: 600,
            }}
          >
            Batal
          </button>
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};