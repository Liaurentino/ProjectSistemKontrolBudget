import React, { useEffect, useState } from 'react';
import { insertEntity, updateEntity, getEntities } from '../../lib/supabase';
import { validateAccurateTokenOwnership, quickValidateTokenFormat } from '../../lib/accurateValidate';
import { validateAccurateApiToken } from '../../services/accurateValidation';
import type { AccurateValidationResult, AccurateDatabase } from '../../lib/accurate';
import styles from './EntitasForm.module.css';

interface Props {
  mode: 'create' | 'edit';
  initialData?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

type EntityMethod = 'accurate' | 'manual';

export const EntitasForm: React.FC<Props> = ({
  mode,
  initialData,
  onSuccess,
  onCancel,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<EntityMethod>('accurate');
  const [formData, setFormData] = useState({
    entity_name: '',
    description: '',
    api_token: '',
  });

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [tokenValidated, setTokenValidated] = useState(false);
  const [ownershipValidated, setOwnershipValidated] = useState(false);
  const [formatError, setFormatError] = useState('');

  const [validationResult, setValidationResult] = useState<AccurateValidationResult | null>(null);
  const [databases, setDatabases] = useState<AccurateDatabase[]>([]);
  
  // ========== TAMBAHAN: State untuk database ID ==========
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<number | null>(null);
  // ========================================================

  const [existingTokens, setExistingTokens] = useState<string[]>([]);
  const [tokenDuplicate, setTokenDuplicate] = useState(false);
  const [tokenDuplicateEntity, setTokenDuplicateEntity] = useState('');

  useEffect(() => {
    loadExistingTokens();
  }, []);

  useEffect(() => {
    if (mode === 'edit' && initialData) {
      const method: EntityMethod = initialData.method || (initialData.api_token ? 'accurate' : 'manual');
      setSelectedMethod(method);
      
      setFormData({
        entity_name: initialData.entity_name || '',
        description: initialData.description || '',
        api_token: initialData.api_token || '',
      });
      
      // ========== TAMBAHAN: Set database ID jika ada ==========
      if (initialData.accurate_database_id) {
        setSelectedDatabaseId(initialData.accurate_database_id);
      }
      // =========================================================
      
      if (initialData.api_token && method === 'accurate') {
        setTokenValidated(true);
        setOwnershipValidated(true);
      }
    }
  }, [mode, initialData]);

  const loadExistingTokens = async () => {
    try {
      const { data, error: err } = await getEntities();
      if (err) throw err;

      const tokens = (data || [])
        .filter((e: any) => e.api_token)
        .map((e: any) => e.api_token);
      setExistingTokens(tokens);
    } catch (err) {
      console.error('Error loading existing tokens:', err);
    }
  };

  const handleMethodChange = (method: EntityMethod) => {
    setSelectedMethod(method);
    setError('');
    setSuccess('');
    setTokenValidated(false);
    setOwnershipValidated(false);
    setValidationResult(null);
    setDatabases([]);
    setFormatError('');
    setTokenDuplicate(false);
    setSelectedDatabaseId(null); // ← RESET database ID
    
    setFormData({
      entity_name: '',
      description: '',
      api_token: '',
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    setError('');
    setSuccess('');

    if (name === 'api_token' && selectedMethod === 'accurate') {
      setTokenValidated(false);
      setOwnershipValidated(false);
      setValidationResult(null);
      setDatabases([]);
      setTokenDuplicate(false);
      setTokenDuplicateEntity('');
      setSelectedDatabaseId(null); // ← RESET database ID saat token berubah
      
      if (value.trim()) {
        const formatErr = quickValidateTokenFormat(value);
        setFormatError(formatErr || '');
      } else {
        setFormatError('');
      }
      
      setFormData(prev => ({
        ...prev,
        entity_name: '',
        api_token: value,
      }));

      if (value.trim() && value !== initialData?.api_token) {
        const isDuplicate = existingTokens.includes(value.trim());
        if (isDuplicate) {
          setTokenDuplicate(true);
          getEntities().then(({ data: entities }) => {
            const duplicateEntity = entities?.find(
              (e: any) => e.api_token === value.trim()
            );
            setTokenDuplicateEntity(duplicateEntity?.entity_name || 'Entitas lain');
          });
        }
      }
    }
  };

  const handleValidateToken = async () => {
    setError('');
    setSuccess('');
    setValidating(true);

    try {
      if (!formData.api_token.trim()) {
        setError('API Token tidak boleh kosong');
        setValidating(false);
        return;
      }

      if (formatError) {
        setError(formatError);
        setValidating(false);
        return;
      }

      if (tokenDuplicate && formData.api_token !== initialData?.api_token) {
        setError(
          `API Token ini sudah digunakan oleh "${tokenDuplicateEntity}". Gunakan token yang berbeda.`
        );
        setValidating(false);
        return;
      }

      const ownershipResult = await validateAccurateTokenOwnership(formData.api_token);

      if (!ownershipResult.isValid) {
        const errorMsg = ownershipResult.error || 
          'Token ini bukan milik akun Anda. Silakan gunakan token dari akun Accurate yang sesuai dengan email login Anda.';
        
        setError(errorMsg);
        setOwnershipValidated(false);
        setTokenValidated(false);
        setDatabases([]);
        setSelectedDatabaseId(null); // ← RESET database ID
        setFormData(prev => ({
          ...prev,
          entity_name: '',
        }));
        setValidating(false);
        return;
      }

      setOwnershipValidated(true);

      const result = await validateAccurateApiToken(formData.api_token);
      setValidationResult(result);

      if (result.isValid) {
        setSuccess(
          `Token valid dan milik akun Anda (${ownershipResult.accurateUserInfo?.email})\n` +
          result.message
        );
        setTokenValidated(true);

        // ========== SIMPAN DATABASE ID ==========
        if (result.primaryDatabase?.id) {
          setSelectedDatabaseId(result.primaryDatabase.id);
          console.log('✅ Database ID saved:', result.primaryDatabase.id);
        }
        // =========================================

        if (result.primaryDatabase?.name) {
          setFormData(prev => ({
            ...prev,
            entity_name: result.primaryDatabase!.name,
          }));
        }

        if (result.databases && Array.isArray(result.databases)) {
          setDatabases(result.databases);
        }
      } else {
        setError(result.message);
        setTokenValidated(false);
        setOwnershipValidated(false);
        setDatabases([]);
        setSelectedDatabaseId(null); // ← RESET database ID
        setFormData(prev => ({
          ...prev,
          entity_name: '',
        }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal validasi token';
      setError(message);
      setTokenValidated(false);
      setOwnershipValidated(false);
      setSelectedDatabaseId(null); // ← RESET database ID
      setFormData(prev => ({
        ...prev,
        entity_name: '',
      }));
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!formData.entity_name.trim()) {
        if (selectedMethod === 'accurate') {
          setError('Nama Entitas tidak boleh kosong. Silakan validasi token terlebih dahulu.');
        } else {
          setError('Nama Entitas tidak boleh kosong');
        }
        setLoading(false);
        return;
      }

      if (selectedMethod === 'accurate') {
        if (!formData.api_token.trim()) {
          setError('API Token tidak boleh kosong');
          setLoading(false);
          return;
        }

        if (formatError) {
          setError(formatError);
          setLoading(false);
          return;
        }

        if (tokenDuplicate && formData.api_token !== initialData?.api_token) {
          setError(
            `API Token ini sudah digunakan oleh "${tokenDuplicateEntity}". Gunakan token yang berbeda.`
          );
          setLoading(false);
          return;
        }

        // ========== VALIDASI DATABASE ID ==========
        if (mode === 'create' && !selectedDatabaseId) {
          setError(
            'Database ID tidak ditemukan. Silakan validasi token terlebih dahulu untuk mendapatkan informasi database.'
          );
          setLoading(false);
          return;
        }
        // ==========================================

        if (mode === 'create' && !tokenValidated) {
          setError(
            'PERINGATAN: Anda belum memvalidasi API Token!\n\n' +
            'Silakan klik tombol "Validasi Token" terlebih dahulu untuk:\n' +
            '• Memverifikasi bahwa token milik akun Anda\n' +
            '• Memastikan token valid dan dapat diakses\n' +
            '• Mengecek koneksi ke Accurate\n' +
            '• Memverifikasi database yang terhubung\n' +
            '• Mengambil nama entitas dari Accurate\n\n' +
            'Setelah validasi berhasil, barulah Anda bisa menyimpan.'
          );
          setLoading(false);
          return;
        }

        if (mode === 'create' && !ownershipValidated) {
          setError(
            'Token belum divalidasi kepemilikannya. Silakan validasi token terlebih dahulu.'
          );
          setLoading(false);
          return;
        }
      }

      const dataToSave: any = {
        entity_name: formData.entity_name.trim(),
        method: selectedMethod,
      };

      if (selectedMethod === 'accurate') {
        dataToSave.api_token = formData.api_token.trim();
        // ========== KIRIM DATABASE ID ==========
        dataToSave.accurate_database_id = selectedDatabaseId;
        console.log('💾 Saving entity with database ID:', selectedDatabaseId);
        // ========================================
      } else {
        dataToSave.description = formData.description.trim() || null;
        dataToSave.api_token = null;
        dataToSave.accurate_database_id = null; // ← Manual entry tidak punya database ID
      }

      if (mode === 'create') {
        const result = await insertEntity(dataToSave);
        if (result.error) {
          throw new Error(result.error);
        }
        console.log('✅ Entity created:', result.data);
      } else {
        const result = await updateEntity(initialData.id, dataToSave);
        if (result.error) {
          throw new Error(result.error);
        }
        console.log('✅ Entity updated:', result.data);
      }

      setSuccess(
        mode === 'create'
          ? 'Entitas berhasil ditambahkan'
          : 'Entitas berhasil diubah'
      );

      setTimeout(onSuccess, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan entitas';
      setError(`Error: ${message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {mode === 'create' && (
        <div className={styles.methodSelectorContainer}>
          <label className={`form-label ${styles.methodSelectorLabel}`}>
            Pilih Metode Penambahan:
          </label>
          <div className={styles.methodButtons}>
            <button
              type="button"
              onClick={() => handleMethodChange('accurate')}
              className={`${styles.methodButton} ${
                selectedMethod === 'accurate' ? styles.active : styles.inactive
              }`}
            >
              <div className={styles.methodTitle}>Via Accurate</div>
              <div className={styles.methodDescription}>Validasi & auto-fill data</div>
            </button>

            <button
              type="button"
              onClick={() => handleMethodChange('manual')}
              className={`${styles.methodButton} ${
                selectedMethod === 'manual' ? styles.active : styles.inactive
              }`}
            >
              <div className={styles.methodTitle}>Input Manual</div>
              <div className={styles.methodDescription}>Tanpa API, langsung simpan</div>
            </button>
          </div>
        </div>
      )}

      {mode === 'edit' && (
        <div className={styles.methodInfo}>
          <small className={styles.methodInfoText}>
            <strong>Metode: </strong>
            {selectedMethod === 'accurate' ? 'Via Accurate' : 'Input Manual'}
          </small>
        </div>
      )}

      {error && (
        <div className={`${styles.errorAlert} ${error.includes('Email Akun') ? styles.critical : ''}`}>
          {error.includes('Email Akun') ? (
            <div>
              <div className={styles.errorAlertHeader}>
                <strong className={styles.errorAlertTitle}>Token Tidak Cocok dengan Akun Anda!</strong>
              </div>
              <div className={styles.errorAlertMessage}>{error}</div>
            </div>
          ) : (
            error
          )}
        </div>
      )}

      {success && (
        <div className={styles.successAlert}>
          {success}
        </div>
      )}

      {selectedMethod === 'accurate' && (
        <>
          <div className="form-group">
            <label className="form-label">API Token Accurate</label>
            <div className={styles.tokenInputWrapper}>
              <input
                type={showToken ? 'text' : 'password'}
                name="api_token"
                value={formData.api_token}
                onChange={handleChange}
                className={`form-control ${styles.tokenInput} ${
                  tokenDuplicate || formatError ? styles.error : ''
                }`}
                placeholder="Masukkan API Token dari Accurate"
                required
                disabled={validating || loading}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className={styles.showTokenButton}
              >
                {showToken ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>

            {formatError && !tokenDuplicate && (
              <div className={styles.formatError}>
                <span>{formatError}</span>
              </div>
            )}

            {tokenDuplicate && formData.api_token !== initialData?.api_token && (
              <div className={styles.tokenDuplicateWarning}>
                <span>
                  <strong>Token Sudah Terdaftar!</strong> Token ini sudah digunakan oleh entitas
                  "{tokenDuplicateEntity}". Gunakan token yang berbeda.
                </span>
              </div>
            )}

            <button
              type="button"
              className={`btn btn-sm ${styles.validateButton} ${
                tokenValidated && ownershipValidated
                  ? styles.validated
                  : !tokenValidated && formData.api_token
                  ? styles.pending
                  : ''
              }`}
              onClick={handleValidateToken}
              disabled={validating || loading || !formData.api_token.trim() || tokenDuplicate || !!formatError}
            >
              {validating
                ? 'Validasi Token...'
                : tokenValidated && ownershipValidated
                ? 'Token Valid & Milik Anda'
                : 'Validasi Token'}
            </button>

            <small className={styles.helperText}>
              Token untuk autentikasi API Accurate (Lihat Panduan Lengkap Cara Mendapatkan API Token)
            </small>
          </div>

          {mode === 'create' && formData.api_token && !tokenValidated && !tokenDuplicate && !formatError && (
            <div className={styles.pendingValidationWarning}>
              <div>
                <strong className={styles.pendingValidationTitle}>
                  Token Belum Divalidasi
                </strong>
                <small className={styles.pendingValidationText}>
                  Silakan klik tombol "Validasi Token" di atas untuk:
                  <br />• Memverifikasi bahwa token milik akun Anda
                  <br />• Memastikan koneksi ke Accurate
                  <br />• Mengecek kepastian data usaha di database
                </small>
              </div>
            </div>
          )}

          {formData.entity_name && (
            <div className="form-group">
              <label className="form-label">Nama Entitas</label>
              <input
                type="text"
                name="entity_name"
                value={formData.entity_name}
                className={`form-control ${styles.entityNameInput}`}
                readOnly
              />
              <small className={styles.helperText}>
                {mode === 'edit' ? 'Nama entitas yang tersimpan' : 'Nama diambil otomatis dari database Accurate'}
              </small>
            </div>
          )}

          {tokenValidated && validationResult?.primaryDatabase && (
            <div className={styles.databaseBox}>
              <h4 className={styles.databaseBoxTitle}>
                Database Terdeteksi
              </h4>

              <div>
                <small className={styles.databaseIdLabel}>
                  <strong>ID Database:</strong>
                </small>
                <code className={styles.databaseIdCode}>
                  {validationResult.primaryDatabase.id || '-'}
                </code>
              </div>

              {databases.length > 1 && (
                <div className={styles.databaseListContainer}>
                  <small className={styles.databaseListTitle}>
                    <strong>Database Lainnya ({databases.length} total):</strong>
                  </small>
                  <div className={styles.databaseList}>
                    {databases.map((db) => (
                      <div key={db.id} className={styles.databaseItem}>
                        <span className={styles.databaseItemName}>{db.name}</span>
                        <code className={styles.databaseItemCode}>
                          ID: {db.id}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className={styles.securityWarning}>
            <strong>Penting!</strong> API Token Anda Bersifat Rahasia. Jangan bagikan dengan orang lain.
          </div>
        </>
      )}

      {selectedMethod === 'manual' && (
        <>
          <div className="form-group">
            <label className="form-label">Nama Entitas</label>
            <input
              type="text"
              name="entity_name"
              value={formData.entity_name}
              onChange={handleChange}
              className="form-control"
              placeholder="Masukkan nama entitas"
              required
              disabled={loading}
            />
            <small className={styles.helperText}>
              Nama entitas yang akan ditampilkan di sistem
            </small>
          </div>

          <div className={styles.infoBox}>
            <strong>Info:</strong> Entitas manual tidak terhubung dengan Accurate. Data akan disimpan langsung tanpa validasi API.
          </div>
        </>
      )}

      <div className={styles.formActions}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
          disabled={loading || validating}
        >
          Batal
        </button>

        <button
          type="submit"
          className={`btn btn-primary ${styles.submitButton} ${
            selectedMethod === 'accurate' && mode === 'create' && (!tokenValidated || !ownershipValidated) && formData.api_token
              ? styles.disabled
              : ''
          }`}
          disabled={
            loading || 
            validating || 
            (selectedMethod === 'accurate' && mode === 'create' && (!tokenValidated || !ownershipValidated)) ||
            (selectedMethod === 'accurate' && tokenDuplicate) ||
            (selectedMethod === 'accurate' && !!formatError)
          }
        >
          {loading ? 'Menyimpan...' : mode === 'create' ? 'Simpan' : 'Update'}
        </button>
      </div>
    </form>
  );
};