import React, { useEffect, useState } from 'react';
import { insertEntity, updateEntity, getEntities } from '../lib/supabase';
import { validateAccurateApiToken } from '../services/accurateValidation';
import type { AccurateValidationResult, AccurateDatabase } from '../lib/accurate';

interface Props {
  mode: 'create' | 'edit';
  initialData?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export const EntitasForm: React.FC<Props> = ({
  mode,
  initialData,
  onSuccess,
  onCancel,
}) => {
  // Form states
  const [formData, setFormData] = useState({
    entity_name: '',
    api_token: '',
  });

  // Validation states
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [tokenValidated, setTokenValidated] = useState(false);

  // Validation result
  const [validationResult, setValidationResult] = useState<AccurateValidationResult | null>(null);
  const [databases, setDatabases] = useState<AccurateDatabase[]>([]);

  // Token checking states
  const [existingTokens, setExistingTokens] = useState<string[]>([]);
  const [tokenDuplicate, setTokenDuplicate] = useState(false);
  const [tokenDuplicateEntity, setTokenDuplicateEntity] = useState('');

  // Load existing tokens
  useEffect(() => {
    loadExistingTokens();
  }, []);

  // Isi data saat edit
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData({
        entity_name: initialData.entity_name || '',
        api_token: initialData.api_token || '',
      });
      if (initialData.api_token) {
        setTokenValidated(true);
      }
    }
  }, [mode, initialData]);

  /**
   * Load semua token yang sudah ada
   */
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

    // Check duplikasi token saat user mengetik
    if (name === 'api_token') {
      setTokenValidated(false);
      setValidationResult(null);
      setDatabases([]);
      setTokenDuplicate(false);
      setTokenDuplicateEntity('');
      
      // Reset nama entitas karena token berubah
      setFormData(prev => ({
        ...prev,
        entity_name: '',
        api_token: value,
      }));

      // Check if token sudah ada (kecuali untuk edit mode dengan token yang sama)
      if (value.trim() && value !== initialData?.api_token) {
        const isDuplicate = existingTokens.includes(value.trim());
        if (isDuplicate) {
          setTokenDuplicate(true);
          // Find entity name yang pake token ini
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

  /**
   * Validasi API Token
   */
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

      // Check duplikasi token
      if (tokenDuplicate && formData.api_token !== initialData?.api_token) {
        setError(
          `❌ API Token ini sudah digunakan oleh "${tokenDuplicateEntity}". Gunakan token yang berbeda.`
        );
        setValidating(false);
        return;
      }

      console.log('Validating token in component...');
      const result = await validateAccurateApiToken(formData.api_token);

      setValidationResult(result);

      if (result.isValid) {
        setSuccess(result.message);
        setTokenValidated(true);

        // AUTO-FILL: Set nama entitas dari primary database
        if (result.primaryDatabase?.name) {
          setFormData(prev => ({
            ...prev,
            entity_name: result.primaryDatabase!.name,
          }));
        }

        // Set databases dari hasil validasi
        if (result.databases && Array.isArray(result.databases)) {
          setDatabases(result.databases);
        }
      } else {
        setError(result.message);
        setTokenValidated(false);
        setDatabases([]);
        // Reset nama entitas jika validasi gagal
        setFormData(prev => ({
          ...prev,
          entity_name: '',
        }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal validasi token';
      setError(message);
      setTokenValidated(false);
      setFormData(prev => ({
        ...prev,
        entity_name: '',
      }));
    } finally {
      setValidating(false);
    }
  };

  /**
   * Handle submit form
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validasi input
      if (!formData.entity_name.trim()) {
        setError('❌ Nama Entitas tidak boleh kosong. Silakan validasi token terlebih dahulu.');
        setLoading(false);
        return;
      }

      if (!formData.api_token.trim()) {
        setError('❌ API Token tidak boleh kosong');
        setLoading(false);
        return;
      }

      // Cek duplikasi token
      if (tokenDuplicate && formData.api_token !== initialData?.api_token) {
        setError(
          `❌ API Token ini sudah digunakan oleh "${tokenDuplicateEntity}". Gunakan token yang berbeda.`
        );
        setLoading(false);
        return;
      }

      // PENTING: Cek apakah token sudah divalidasi
      if (!tokenValidated) {
        setError(
          '⚠️ PERINGATAN: Anda belum memvalidasi API Token!\n\n' +
          'Silakan klik tombol "🔍 Validasi Token" terlebih dahulu untuk:\n' +
          '• Memastikan token valid dan dapat diakses\n' +
          '• Mengecek koneksi ke Accurate\n' +
          '• Memverifikasi database yang terhubung\n' +
          '• Mengambil nama entitas dari Accurate\n\n' +
          'Setelah validasi berhasil, barulah Anda bisa menyimpan.'
        );
        setLoading(false);
        return;
      }

      // Prepare data untuk disimpan
      const dataToSave = {
        entity_name: formData.entity_name.trim(),
        api_token: formData.api_token.trim(),
      };

      // Save to database
      if (mode === 'create') {
        const { error: err } = await insertEntity(dataToSave);
        if (err) throw new Error(typeof err === 'string' ? err : err.message);
      } else {
        const { error: err } = await updateEntity(initialData.id, dataToSave);
        if (err) throw new Error(typeof err === 'string' ? err : err.message);
      }

      setSuccess(
        mode === 'create'
          ? '✅ Entitas berhasil ditambahkan'
          : '✅ Entitas berhasil diubah'
      );

      setTimeout(onSuccess, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan entitas';
      setError(`❌ Error: ${message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card fade-in">
      <div className="card-header">
        <h3 className="card-title">
          {mode === 'edit' ? 'Edit Entitas' : 'Tambah Entitas Baru'}
        </h3>
      </div>

      <div className="card-body">
        {/* ERROR MESSAGE */}
        {error && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#ffebee',
              color: '#c62828',
              borderRadius: '4px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              border: '2px solid #ef5350',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.5',
            }}
          >
            {error}
          </div>
        )}

        {/* SUCCESS MESSAGE */}
        {success && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#e8f5e9',
              color: '#2e7d32',
              borderRadius: '4px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              border: '2px solid #66bb6a',
            }}
          >
            {success}
          </div>
        )}

        {/* API Token */}
        <div className="form-group">
          <label className="form-label">API Token Accurate</label>
          <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
            <input
              type={showToken ? 'text' : 'password'}
              name="api_token"
              value={formData.api_token}
              onChange={handleChange}
              className="form-control"
              placeholder="Masukkan API Token dari Accurate"
              required
              disabled={validating || loading}
              style={{
                borderColor: tokenDuplicate ? '#f44336' : undefined,
                backgroundColor: tokenDuplicate ? '#ffebee' : undefined,
              }}
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.2rem',
                padding: 0,
              }}
            >
              {showToken ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>

          {/* WARNING: Token Duplikasi */}
          {tokenDuplicate && formData.api_token !== initialData?.api_token && (
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: '#ffebee',
                color: '#c62828',
                borderRadius: '4px',
                marginBottom: '0.5rem',
                fontSize: '0.85rem',
                border: '1px solid #ef5350',
                display: 'flex',
                gap: '0.5rem',
              }}
            >
              <span>⚠️</span>
              <span>
                <strong>Token Sudah Terdaftar!</strong> Token ini sudah digunakan oleh entitas
                "{tokenDuplicateEntity}". Gunakan token yang berbeda.
              </span>
            </div>
          )}

          {/* TOMBOL VALIDASI */}
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleValidateToken}
            disabled={validating || loading || !formData.api_token.trim() || tokenDuplicate}
            style={{
              width: '100%',
              marginBottom: '0.5rem',
              backgroundColor: tokenValidated ? '#4caf50' : undefined,
              color: tokenValidated ? '#fff' : undefined,
              border: !tokenValidated && formData.api_token ? '2px solid #ff9800' : undefined,
              fontWeight: !tokenValidated && formData.api_token ? 'bold' : 'normal',
            }}
          >
            {validating
              ? '⏳ Validasi Token...'
              : tokenValidated
              ? '✅ Token Valid'
              : '🔍 Validasi Token'}
          </button>

          <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
            Token untuk autentikasi API Accurate (akan dienkripsi dan disimpan)
          </small>
        </div>

        {/* WARNING: Token Belum Divalidasi */}
        {formData.api_token && !tokenValidated && !tokenDuplicate && (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#fff3e0',
              color: '#e65100',
              borderRadius: '4px',
              marginBottom: '1rem',
              border: '2px solid #ffb74d',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-start',
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <div>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>
                Token Belum Divalidasi
              </strong>
              <small>
                Silakan klik tombol "🔍 Validasi Token" di atas untuk memverifikasi token
                dan mengambil nama entitas dari Accurate.
              </small>
            </div>
          </div>
        )}

        {/* Nama Entitas - READ ONLY (Auto-filled dari API) */}
        {formData.entity_name && (
          <div className="form-group">
            <label className="form-label">Nama Entitas</label>
            <input
              type="text"
              name="entity_name"
              value={formData.entity_name}
              className="form-control"
              readOnly
              style={{
                backgroundColor: '#f5f5f5',
                cursor: 'not-allowed',
                color: '#333',
                fontWeight: 500,
              }}
            />
            <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
              {mode === 'edit' ? '✓ Nama entitas yang tersimpan' : '✓ Nama diambil otomatis dari database Accurate'}
            </small>
          </div>
        )}

        {/* Database Info - Jika Token Valid */}
        {tokenValidated && validationResult?.primaryDatabase && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#f1f8e9',
              borderRadius: '8px',
              marginBottom: '1rem',
              border: '1px solid #c5e1a5',
            }}
          >
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#33691e', fontSize: '0.95rem' }}>
              ✓ Database Terdeteksi
            </h4>

            <div>
              <small style={{ color: '#666', display: 'block', marginBottom: '0.25rem' }}>
                <strong>ID Database:</strong>
              </small>
              <code
                style={{
                  backgroundColor: '#fff',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  display: 'inline-block',
                  fontSize: '0.9rem',
                  color: '#333',
                  fontWeight: 500,
                }}
              >
                {validationResult.primaryDatabase.id || '-'}
              </code>
            </div>

            {/* Available Databases */}
            {databases.length > 1 && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #c5e1a5' }}>
                <small style={{ color: '#666', display: 'block', marginBottom: '0.5rem' }}>
                  <strong>Database Lainnya ({databases.length} total):</strong>
                </small>
                <div
                  style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  {databases.map((db) => (
                    <div
                      key={db.id}
                      style={{
                        padding: '0.5rem',
                        backgroundColor: '#fff',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{db.name}</span>
                      <code style={{ fontSize: '0.8rem', color: '#666' }}>
                        ID: {db.id}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Security Warning */}
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#fff3e0',
            color: '#e65100',
            borderRadius: '4px',
            fontSize: '0.8rem',
          }}
        >
          🔒 <strong>Keamanan:</strong> API Token akan disimpan terenkripsi di database. Jangan
          bagikan dengan orang lain.
        </div>
      </div>

      <div className="form-actions">
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
          className="btn btn-primary"
          disabled={loading || validating || !tokenValidated || tokenDuplicate}
          style={{
            opacity: !tokenValidated && formData.api_token ? 0.5 : 1,
            cursor: !tokenValidated && formData.api_token ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '⏳ Menyimpan...' : '✓ Simpan'}
        </button>
      </div>
    </form>
  );
};