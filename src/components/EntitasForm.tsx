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

  // Entity name checking states
  const [availableDatabaseNames, setAvailableDatabaseNames] = useState<string[]>([]);
  const [nameMatches, setNameMatches] = useState<
    Array<{ value: string; similarity:  number }>
  >([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [selectedNameSuggestion, setSelectedNameSuggestion] = useState<string | null>(null);

  // Load existing tokens dan databases
  useEffect(() => {
    loadExistingData();
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
   * Load semua token dan database names yang sudah ada
   */
  const loadExistingData = async () => {
    try {
      const { data, error:  err } = await getEntities();
      if (err) throw err;

      // Load tokens
      const tokens = (data || [])
        .filter((e: any) => e.api_token)
        .map((e: any) => e.api_token);
      setExistingTokens(tokens);

      // Load database names dari entitas yang sudah ada
      const dbNames = (data || [])
        .filter((e: any) => e.entity_name)
        .map((e: any) => e.entity_name);
      setAvailableDatabaseNames(dbNames);
    } catch (err) {
      console.error('Error loading existing data:', err);
    }
  };

  /**
   * Check entity name dengan fuzzy matching
   */
  const checkEntityName = (name: string) => {
    if (! name. trim() || availableDatabaseNames.length === 0) {
      setNameMatches([]);
      setShowNameSuggestions(false);
      return;
    }

    const matches = findFuzzyMatches(name, availableDatabaseNames, 0.65);

    if (matches.length > 0) {
      setNameMatches(matches);
      setShowNameSuggestions(true);
    } else {
      setNameMatches([]);
      setShowNameSuggestions(false);
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
    setSelectedNameSuggestion(null);

    // Check entity name
    if (name === 'entity_name') {
      checkEntityName(value);
    }

    // Check duplikasi token saat user mengetik
    if (name === 'api_token') {
      setTokenValidated(false);
      setValidationResult(null);
      setDatabases([]);
      setTokenDuplicate(false);
      setTokenDuplicateEntity('');

      // Check if token sudah ada (kecuali untuk edit mode dengan token yang sama)
      if (value. trim() && value !== initialData?.api_token) {
        const isDuplicate = existingTokens. includes(value. trim());
        if (isDuplicate) {
          setTokenDuplicate(true);
          // Find entity name yang pake token ini
          const { data: entities } = getEntities();
          entities?. then((ents) => {
            const duplicateEntity = ents?. find(
              (e: any) => e.api_token === value.trim()
            );
            setTokenDuplicateEntity(duplicateEntity?.entity_name || 'Entitas lain');
          });
        }
      }
    }
  };

  /**
   * Apply name suggestion
   */
  const applyNameSuggestion = (suggestedName: string) => {
    setFormData({
      ...formData,
      entity_name: suggestedName,
    });
    setSelectedNameSuggestion(suggestedName);
    setShowNameSuggestions(false);
    setNameMatches([]);
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
  const handleSubmit = async (e:  React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validasi input
      if (!formData.entity_name.trim()) {
        setError('❌ Nama Entitas tidak boleh kosong');
        setLoading(false);
        return;
      }

      if (!formData.api_token. trim()) {
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
      if (! tokenValidated) {
        setError(
          '⚠️ PERINGATAN:  Anda belum memvalidasi API Token!\n\n' +
          'Silakan klik tombol "🔍 Validasi Token" terlebih dahulu untuk:\n' +
          '• Memastikan token valid dan dapat diakses\n' +
          '• Mengecek koneksi ke Accurate\n' +
          '• Memverifikasi database yang terhubung\n\n' +
          'Setelah validasi berhasil, barulah Anda bisa menyimpan.'
        );
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
        if (err) throw new Error(typeof err === 'string' ?  err : err.message);
      }

      setSuccess(
        mode === 'create'
          ? '✅ Entitas berhasil ditambahkan'
          : '✅ Entitas berhasil diubah'
      );

      setTimeout(onSuccess, 1500);
    } catch (err) {
      const message = err instanceof Error ? err. message : 'Gagal menyimpan entitas';
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

        {/* Nama Entitas */}
        <div className="form-group">
          <label className="form-label">Nama Entitas</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              name="entity_name"
              value={formData.entity_name}
              onChange={handleChange}
              onFocus={() => {
                if (nameMatches.length > 0) {
                  setShowNameSuggestions(true);
                }
              }}
              className="form-control"
              placeholder="Contoh: PT Cipta Piranti Sejahtera"
              required
              style={{
                borderColor: selectedNameSuggestion ? '#4caf50' : undefined,
              }}
            />

            {/* Name Suggestions Dropdown */}
            {showNameSuggestions && nameMatches.length > 0 && (
              <div
                style={{
                  position:  'absolute',
                  top: '100%',
                  left:  0,
                  right: 0,
                  backgroundColor: '#fff',
                  border: '1px solid #ddd',
                  borderRadius:  '4px',
                  marginTop: '0.25rem',
                  zIndex: 1000,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  maxHeight: '250px',
                  overflowY: 'auto',
                }}
              >
                <div
                  style={{
                    padding: '0.5rem',
                    backgroundColor: '#f5f5f5',
                    fontSize: '0.85rem',
                    color: '#666',
                    borderBottom: '1px solid #eee',
                  }}
                >
                  💡 Saran nama yang mirip:
                </div>

                {nameMatches.map((match, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyNameSuggestion(match.value)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '0.75rem',
                      border: 'none',
                      backgroundColor: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget).style.backgroundColor = '#f9f9f9';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget).style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500 }}>{match.value}</span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          backgroundColor: '#e8f5e9',
                          color: '#2e7d32',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '3px',
                        }}
                      >
                        {Math.round(match.similarity * 100)}% match
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
            Nama perusahaan atau unit bisnis Anda
            {selectedNameSuggestion && (
              <span style={{ color: '#4caf50', marginLeft: '0.5rem' }}>
                ✓ Menggunakan saran
              </span>
            )}
          </small>
        </div>

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
                fontSize: '1. 2rem',
                padding: 0,
              }}
            >
              {showToken ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>

          {/* WARNING:  Token Duplikasi */}
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
                <strong>Token Sudah Terdaftar!  </strong> Token ini sudah digunakan oleh entitas
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
              border: ! tokenValidated && formData.api_token ?  '2px solid #ff9800' : undefined,
              fontWeight: ! tokenValidated && formData.api_token ? 'bold' :  'normal',
            }}
          >
            {validating
              ? '⏳ Validasi Token.. .'
              : tokenValidated
              ? '✅ Token Valid'
              : '🔍 Validasi Token'}
          </button>

          <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
            Token untuk autentikasi API Accurate (akan dienkripsi dan disimpan)
          </small>
        </div>

        {/* WARNING: Token Belum Divalidasi */}
        {formData.api_token && !tokenValidated && ! tokenDuplicate && (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#fff3e0',
              color: '#e65100',
              borderRadius:  '4px',
              marginBottom: '1rem',
              border: '2px solid #ffb74d',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-start',
            }}
          >
            <span style={{ fontSize: '1. 2rem' }}>⚠️</span>
            <div>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>
                Token Belum Divalidasi
              </strong>
              <small>
                Silakan klik tombol "🔍 Validasi Token" di atas untuk memverifikasi token
                sebelum menyimpan entitas.
              </small>
            </div>
          </div>
        )}

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

            <div style={{ display: 'grid', gridTemplateColumns:  '1fr 1fr', gap:  '1rem' }}>
              <div>
                <small style={{ color: '#666', display: 'block', marginBottom: '0.25rem' }}>
                  <strong>Nama Database:</strong>
                </small>
                <p style={{ margin: 0, color: '#333', fontWeight: 500 }}>
                  {validationResult.primaryDatabase.name || '-'}
                </p>
              </div>

              <div>
                <small style={{ color: '#666', display: 'block', marginBottom:  '0.25rem' }}>
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
                    borderRadius: '4px',
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
                        transition:  'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget).style.borderColor = '#7cb342';
                        (e. currentTarget).style.backgroundColor = '#f9fbe7';
                      }}
                      onMouseLeave={(e) => {
                        (e. currentTarget).style.borderColor = '#ddd';
                        (e. currentTarget).style.backgroundColor = '#fff';
                      }}
                    >
                      <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                        {db. name}
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
            borderRadius: '4px',
            fontSize: '0.8rem',
          }}
        >
          🔒 <strong>Keamanan:  </strong> API Token akan disimpan terenkripsi di database.  Jangan
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
            opacity: ! tokenValidated && formData.api_token ?  0.5 : 1,
            cursor: ! tokenValidated && formData.api_token ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '⏳ Menyimpan...' : '✓ Simpan'}
        </button>
      </div>
    </form>
  );
};