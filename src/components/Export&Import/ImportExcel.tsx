import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { importCoaFromExcel } from '../../lib/supabase';
import styles from './ImportExcel.module.css';

interface ImportExcelProps {
  entityId: string; // ✅ Changed from number to string
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
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (!rawData || rawData.length === 0) {
        setDetectedFormat('unknown');
        setPreviewData([]);
        return;
      }

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
          break;
        }
      }

      if (headerRowIndex === -1) {
        headerRowIndex = 0;
      }

      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      range.s.r = headerRowIndex;
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        range: headerRowIndex,
        defval: '' 
      });

      if (!Array.isArray(jsonData) || jsonData.length === 0) {
        setDetectedFormat('unknown');
        setPreviewData([]);
        return;
      }

      const firstRow = jsonData[0] as any;
      const columns = Object.keys(firstRow).map(c => c.toLowerCase().trim());

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

      const format = (hasAccountCode && hasAccountName) ? 'standard' : 'unknown';

      setDetectedFormat(format);
      setPreviewData(jsonData.slice(0, 5));

    } catch (err) {
      console.error('[ImportExcel] Error reading file:', err);
      setDetectedFormat('unknown');
      setPreviewData([]);
    }
  };

  // Helper: Find column value with flexible matching
  const findColumnValue = (row: any, possibleNames: string[]): any => {
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

  // Transform data based on detected format
  const transformData = (jsonData: any[]) => {
    if (detectedFormat === 'standard') {
      return jsonData.map((row: any) => {
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

        const dbCr = findColumnValue(row, [
          'db/cr', 'dbcr', 'db cr', 'debit/credit', 'type'
        ]);

        if (!accountCode && !accountName) return null;

        const codeStr = String(accountCode || '').toLowerCase().trim();
        const nameStr = String(accountName || '').toLowerCase().trim();
        
        const skipKeywords = ['total', 'subtotal', 'difference', 'grand total', 'sub total'];
        const shouldSkip = skipKeywords.some(keyword => 
          codeStr.includes(keyword) || nameStr.includes(keyword)
        );
        
        if (shouldSkip) {
          return null;
        }

        let finalAccountType = 'ASSET';
        
        if (accountType) {
          finalAccountType = String(accountType).toUpperCase().trim();
        } else {
          const code = String(accountCode || '');
          
          if (code.startsWith('1')) finalAccountType = 'ASSET';
          else if (code.startsWith('2')) finalAccountType = 'LIABILITY';
          else if (code.startsWith('3')) finalAccountType = 'EQUITY';
          else if (code.startsWith('4')) finalAccountType = 'REVENUE';
          else if (code.startsWith('5')) finalAccountType = 'EXPENSE';
          
          if (dbCr) {
            const dbCrStr = String(dbCr).toUpperCase().trim();
            if (dbCrStr.includes('CR') || dbCrStr.includes('CREDIT')) {
              if (code.startsWith('2')) finalAccountType = 'LIABILITY';
              else if (code.startsWith('3')) finalAccountType = 'EQUITY';
              else if (code.startsWith('4')) finalAccountType = 'REVENUE';
            } else if (dbCrStr.includes('DB') || dbCrStr.includes('DEBIT')) {
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
      }).filter(Boolean);
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
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

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

      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      range.s.r = headerRowIndex;
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        range: headerRowIndex,
        defval: '' 
      });

      const accounts = transformData(jsonData);

      if (accounts.length === 0) {
        throw new Error('Tidak ada data valid yang ditemukan di file Excel');
      }

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
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.headerTitle}>Import Chart of Accounts</h2>
          <p className={styles.headerSubtitle}>
            Upload file Excel (.xlsx, .xls, .xlsm, .xlsb) untuk import data COA
          </p>
        </div>

        {/* Drag & Drop Area */}
        <div
          className={`${styles.dropArea} ${dragActive ? styles.dropAreaActive : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.xlsm,.xlsb,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={handleFileChange}
            className={styles.fileInput}
          />
          
          <div className={styles.icon}>📊</div>
          
          {file ? (
            <>
              <p className={styles.fileSelectedTitle}>✓ File dipilih</p>
              <p className={styles.fileSelectedText}>
                {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setDetectedFormat('unknown');
                  setPreviewData([]);
                }}
                className={styles.removeButton}
              >
                Hapus File
              </button>
            </>
          ) : (
            <>
              <p className={styles.dragDropTitle}>
                {dragActive ? 'Drop file di sini' : 'Drag & drop file Excel'}
              </p>
              <p className={styles.dragDropText}>
                atau klik untuk pilih file dari komputer
              </p>
            </>
          )}
        </div>

        {/* Detected Format */}
        {file && detectedFormat !== 'unknown' && (
          <div className={styles.formatDetected}>
            ✓ Format Terdeteksi: Format Standard
          </div>
        )}

        {file && detectedFormat === 'unknown' && (
          <div className={styles.formatUnknown}>
            ⚠ Format tidak dikenali. Pastikan file memiliki kolom yang sesuai.
          </div>
        )}

        {/* Preview Data */}
        {previewData.length > 0 && (
          <div className={styles.previewContainer}>
            <div className={styles.previewHeader}>
              Preview Data (5 baris pertama)
            </div>
            <div className={styles.previewTableWrapper}>
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    <th>Kode Akun</th>
                    <th>Nama Akun</th>
                    <th>Tipe</th>
                    <th className={styles.amount}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, idx) => {
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

                    if (!accountCode && !accountName) return null;

                    let accountType = 'ASSET';
                    const code = String(accountCode || '');
                    if (code.startsWith('1')) accountType = 'ASSET';
                    else if (code.startsWith('2')) accountType = 'LIABILITY';
                    else if (code.startsWith('3')) accountType = 'EQUITY';
                    else if (code.startsWith('4')) accountType = 'REVENUE';
                    else if (code.startsWith('5')) accountType = 'EXPENSE';

                    return (
                      <tr key={idx}>
                        <td className={styles.previewCode}>{String(accountCode || '-')}</td>
                        <td className={styles.previewName}>{String(accountName || '-')}</td>
                        <td>
                          <span className={styles.previewTypeBadge}>{accountType}</span>
                        </td>
                        <td className={`${styles.previewAmount} ${styles.amount}`}>
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
        <div className={styles.formatInfo}>
          <h4 className={styles.formatInfoTitle}>📋 Format Excel yang Didukung:</h4>
          <ul className={styles.formatInfoList}>
            <li><strong>Kolom Wajib:</strong> Kode Akun & Nama Akun (dengan nama apapun)</li>
            <li><strong>Kolom Opsional:</strong> Tipe/Jenis, Saldo/Balance, Currency, Level</li>
            <li><strong>Nama Kolom Fleksibel:</strong> Sistem akan mendeteksi otomatis meski nama beda</li>
            <li>Contoh: "Kode", "Account Code", "Nomor Akun" → semua akan terbaca sebagai Kode Akun</li>
            <li>File harus dalam format Excel (.xlsx, .xls, .xlsm, .xlsb)</li>
          </ul>
        </div>

        {/* Download Template */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <button
            onClick={() => {
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
            className={styles.templateButton}
          >
            📥 Download Template Standard
          </button>
        </div>

        {/* Action Buttons */}
        <div className={styles.actionButtons}>
          <button
            onClick={handleImport}
            disabled={!file || importing || detectedFormat === 'unknown'}
            className={styles.importButton}
          >
            {importing ? (
              <>
                <span className={styles.spinner}>⟳</span>
                {' '}Importing...
              </>
            ) : (
              '📥 Import Sekarang'
            )}
          </button>
          
          <button
            onClick={onClose}
            disabled={importing}
            className={styles.cancelButton}
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};