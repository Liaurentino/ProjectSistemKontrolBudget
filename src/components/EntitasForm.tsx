import React, { useEffect, useState } from 'react';
import { insertEntity, updateEntity } from '../lib/supabase';

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
  const [formData, setFormData] = useState({
    entity_name: '',
    description: '',
    api_token: '',
    secret_key: '',
  });

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    isValid: boolean;
    message: string;
    entityData?: any;
  } | null>(null);

  /* isi data saat edit */
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData({
        entity_name: initialData.entity_name || '',
        description: initialData.description || '',
        api_token: initialData.api_token || '',
        secret_key: initialData.secret_key || '',
      });
    }
  }, [mode, initialData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Reset validation saat ada perubahan
    if (e.target.name === 'api_token' || e.target.name === 'secret_key') {
      setValidationStatus(null);
    }
  };

  // Validasi API token melalui Supabase Edge Function
  const validateAccurateAPI = async () => {
    if (!formData.api_token || !formData.secret_key) {
      alert('API Token dan Secret Key harus diisi');
      return;
    }

    setValidating(true);
    setValidationStatus(null);

    try {
      // URL Supabase Edge Function
      const SUPABASE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/accurate-validate';
      
      const response = await fetch(SUPABASE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          apiToken: formData.api_token,
          secretKey: formData.secret_key,
        }),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Response error:', errorData);
        setValidationStatus({
          isValid: false,
          message: `✗ Error ${response.status}: ${errorData.error || response.statusText}`,
        });
        return;
      }

      const data = await response.json();
      console.log('Response data:', data);

      if (data.s && data.d && data.d.length > 0) {
        // Validasi sukses
        const entity = data.d[0];
        setValidationStatus({
          isValid: true,
          message: `✓ Koneksi berhasil! Entitas: ${entity.alias}`,
          entityData: entity,
        });

        // Auto-fill nama entitas jika kosong
        if (!formData.entity_name) {
          setFormData(prev => ({
            ...prev,
            entity_name: entity.alias,
          }));
        }
      } else {
        setValidationStatus({
          isValid: false,
          message: '✗ Validasi gagal. Response tidak sesuai format yang diharapkan.',
        });
      }
    } catch (err: any) {
      console.error('Validation error:', err);
      
      let errorMessage = '✗ Terjadi kesalahan: ';
      
      if (err.message.includes('Failed to fetch')) {
        errorMessage += 'Tidak dapat terhubung ke Supabase Edge Function. Pastikan function sudah di-deploy.';
      } else {
        errorMessage += err.message || 'Kesalahan tidak diketahui';
      }
      
      setValidationStatus({
        isValid: false,
        message: errorMessage,
      });
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi harus dilakukan terlebih dahulu untuk mode create
    if (mode === 'create' && !validationStatus?.isValid) {
      alert('Silakan validasi API Token dan Secret Key terlebih dahulu');
      return;
    }

    setLoading(true);

    try {
      const dataToSave = {
        entity_name: formData.entity_name,
        description: formData.description,
        api_token: formData.api_token,
        secret_key: formData.secret_key,
      };

      if (mode === 'create') {
        await insertEntity(dataToSave);
      } else {
        await updateEntity(initialData.id, dataToSave);
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan entitas');
    } finally {
      setLoading(false);
    }
  };

  const Form = (
    <form onSubmit={handleSubmit} className="card fade-in">
      <div className="card-header">
        <h3 className="card-title">
          {mode === 'edit' ? 'Edit Entitas' : 'Tambah Entitas'}
        </h3>
      </div>

      <div className="card-body">
        {/* API Configuration Section */}
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '8px',
          marginBottom: '1.5rem'
        }}>
          <h4 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem' }}>
            Konfigurasi API Accurate
          </h4>
          
          <div className="form-group">
            <label className="form-label">API Token</label>
            <input
              type="password"
              name="api_token"
              value={formData.api_token}
              onChange={handleChange}
              className="form-control"
              placeholder="Masukkan API Token dari Accurate"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Secret Key</label>
            <input
              type="password"
              name="secret_key"
              value={formData.secret_key}
              onChange={handleChange}
              className="form-control"
              placeholder="Masukkan Secret Key dari Accurate"
              required
            />
          </div>

          <button
            type="button"
            className="btn btn-info"
            onClick={validateAccurateAPI}
            disabled={validating || !formData.api_token || !formData.secret_key}
            style={{ width: '100%' }}
          >
            {validating ? 'Memvalidasi...' : 'Validasi Koneksi'}
          </button>

          {validationStatus && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem',
                borderRadius: '4px',
                backgroundColor: validationStatus.isValid ? '#d4edda' : '#f8d7da',
                color: validationStatus.isValid ? '#155724' : '#721c24',
                border: `1px solid ${validationStatus.isValid ? '#c3e6cb' : '#f5c6cb'}`,
              }}
            >
              {validationStatus.message}
            </div>
          )}
        </div>

        {/* Entity Information Section */}
        <div className="form-group">
          <label className="form-label">Nama Entitas</label>
          <input
            type="text"
            name="entity_name"
            value={formData.entity_name}
            onChange={handleChange}
            className="form-control"
            placeholder="Akan terisi otomatis setelah validasi"
            required
          />
          <small style={{ color: '#6c757d', fontSize: '0.875rem' }}>
            Nama ini akan terisi otomatis dari Accurate setelah validasi berhasil
          </small>
        </div>

        <div className="form-group">
          <label className="form-label">Deskripsi</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="form-control"
            rows={3}
            placeholder="Tambahkan catatan atau deskripsi (opsional)"
          />
        </div>
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
        >
          Batal
        </button>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || (mode === 'create' && !validationStatus?.isValid)}
        >
          {loading ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </form>
  );

  /* ===== MODE CREATE → FORM BIASA ===== */
  if (mode === 'create') return Form;

  /* ===== MODE EDIT → MODAL OVERLAY ===== */
  return (
    <div className="modal-overlay">
      <div className="modal-card">{Form}</div>
    </div>
  );
};