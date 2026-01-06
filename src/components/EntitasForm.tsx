import React, { useEffect, useState } from 'react';
import { insertEntity, updateEntity } from '../lib/supabase';
import { validateAccurateApiToken } from '../services/accurateValidation';
import type { AccurateValidationResult, AccurateDatabase } from '../lib/accurate';

interface Props {
  mode: 'create' | 'edit';
  initialData?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export const EntitasForm: React. FC<Props> = ({
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

    // Reset validation jika token berubah
    if (name === 'api_token') {
      setTokenValidated(false);
      setValidationResult(null);
      setDatabases([]);
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
      if (!formData.api_token. trim()) {
        setError('API Token tidak boleh kosong');
        setValidating(false);
        return;
      }

      console.log('Validating token in component...');
      const result = await validateAccurateApiToken(formData.api_token);

      setValidationResult(result);

      if (result.isValid) {
        setSuccess(result.message);
        setTokenValidated(true);

        // Set databases dari hasil validasi
        if (result.databases && Array.isArray(result.databases)) {
          setDatabases(result.databases);
        }
      } else {
        setError(result.message);
        setTokenValidated(false);
        setDatabases([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal validasi token';
      setError(message);
      setTokenValidated(false);
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
        setError('Nama Entitas tidak boleh kosong');
        setLoading(false);
        return;
      }

      if (!formData.api_token. trim()) {
        setError('API Token tidak boleh kosong');
        setLoading(false);
        return;
      }

      if (! tokenValidated) {
        setError('Silakan validasi API Token terlebih dahulu');
        setLoading(false);
        return;
      }

      // Prepare data untuk disimpan
      const dataToSave = {
        entity_name: formData.entity_name. trim(),
        api_token:  formData.api_token.trim(),
      };

      // Save to database
      if (mode === 'create') {
        const { error:  err } = await insertEntity(dataToSave);
        if (err) throw new Error(typeof err === 'string' ? err : err.message);
      } else {
        const { error: err } = await updateEntity(initialData. id, dataToSave);
        if (err) throw new Error(typeof err === 'string' ? err : err.message);
      }

      setSuccess(
        mode === 'create'
          ? 'Entitas berhasil ditambahkan'
          : 'Entitas berhasil diubah'
      );

      setTimeout(onSuccess, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan entitas';
      setError(message);
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
              padding: '0.75rem',
              backgroundColor: '#ffebee',
              color: '#c62828',
              borderRadius: '4px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* SUCCESS MESSAGE */}
        {success && (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#e8f5e9',
              color: '#2e7d32',
              borderRadius: '4px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            ✓ {success}
          </div>
        )}

        {/* Nama Entitas */}
        <div className="form-group">
          <label className="form-label">Nama Entitas</label>
          <input
            type="text"
            name="entity_name"
            value={formData.entity_name}
            onChange={handleChange}
            className="form-control"
            placeholder="Contoh: PT Cipta Piranti Sejahtera"
            required
          />
          <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
            Nama perusahaan atau unit bisnis Anda
          </small>
        </div>

        {/* API Token */}
        <div className="form-group">
          <label className="form-label">API Token Accurate</label>
          <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
            <input
              type={showToken ? 'text' :  'password'}
              name="api_token"
              value={formData.api_token}
              onChange={handleChange}
              className="form-control"
              placeholder="Masukkan API Token dari Accurate"
              required
              disabled={validating || loading}
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

          {/* TOMBOL VALIDASI */}
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleValidateToken}
            disabled={validating || loading || !formData.api_token.trim()}
            style={{
              width: '100%',
              marginBottom: '0.5rem',
              backgroundColor: tokenValidated ? '#4caf50' : undefined,
              color: tokenValidated ? '#fff' : undefined,
            }}
          >
            {validating ? '⏳ Validasi Token...' : tokenValidated ? '✓ Token Valid' : '🔍 Validasi Token'}
          </button>

          <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
            Token untuk autentikasi API Accurate (akan dienkripsi dan disimpan)
          </small>
        </div>

        {/* Database Info - Jika Token Valid */}
        {tokenValidated && validationResult?. primaryDatabase && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#f1f8e9',
              borderRadius:  '8px',
              marginBottom: '1rem',
              border: '1px solid #c5e1a5',
            }}
          >
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#33691e', fontSize: '0.95rem' }}>
              ✓ Database Terdeteksi
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap:  '1rem' }}>
              <div>
                <small style={{ color: '#666', display: 'block', marginBottom: '0.25rem' }}>
                  <strong>Nama Database:</strong>
                </small>
                <p style={{ margin: 0, color: '#333', fontWeight: 500 }}>
                  {validationResult.primaryDatabase.name || '-'}
                </p>
              </div>

              <div>
                <small style={{ color:  '#666', display: 'block', marginBottom: '0.25rem' }}>
                  <strong>Kode Database:</strong>
                </small>
                <p style={{ margin: 0, color: '#333', fontWeight: 500 }}>
                  {validationResult.primaryDatabase.code || '-'}
                </p>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <small style={{ color: '#666', display: 'block', marginBottom: '0.25rem' }}>
                  <strong>ID Database:</strong>
                </small>
                <code
                  style={{
                    backgroundColor: '#fff',
                    padding: '0.5rem',
                    borderRadius:  '4px',
                    display: 'block',
                    fontSize: '0.8rem',
                    color: '#666',
                    wordBreak: 'break-all',
                  }}
                >
                  {validationResult. primaryDatabase.id || '-'}
                </code>
              </div>
            </div>

            {/* Available Databases */}
            {databases.length > 1 && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #c5e1a5' }}>
                <small style={{ color: '#666', display: 'block', marginBottom:  '0.5rem' }}>
                  <strong>Database Lainnya ({databases.length} total):</strong>
                </small>
                <div
                  style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
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
                        borderRadius:  '4px',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget).style.borderColor = '#7cb342';
                        (e.currentTarget).style.backgroundColor = '#f9fbe7';
                      }}
                      onMouseLeave={(e) => {
                        (e. currentTarget).style.borderColor = '#ddd';
                        (e. currentTarget).style.backgroundColor = '#fff';
                      }}
                    >
                      <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                        {db.name}
                      </div>
                      <div style={{ color: '#999', fontSize: '0.75rem' }}>
                        {db. code}
                      </div>
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
            borderRadius:  '4px',
            fontSize: '0.8rem',
          }}
        >
          🔒 <strong>Keamanan:  </strong> API Token akan disimpan terenkripsi di database.  Jangan bagikan dengan orang lain.
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
          disabled={loading || validating || !tokenValidated}
        >
          {loading ? '⏳ Menyimpan.. .' : '✓ Simpan'}
        </button>
      </div>
    </form>
  );
};