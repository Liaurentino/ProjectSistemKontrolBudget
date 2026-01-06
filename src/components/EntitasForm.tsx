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
    description: '',
  });

  // Validation states
  const [loading, setLoading] = useState(false);

  /* isi data saat edit */
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData({
        entity_name: initialData.entity_name || '',
        description: initialData.description || '',
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
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'create') {
        await insertEntity(formData);
      } else {
        await updateEntity(initialData.id, formData);
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
        <div className="form-group">
          <label className="form-label">Nama Entitas</label>
          <input
            type="text"
            name="entity_name"
            value={formData.entity_name}
            onChange={handleChange}
            className="form-control"
            required
          />
        </div>

        {/* API Token */}
        <div className="form-group">
          <label className="form-label">Deskripsi</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="form-control"
            rows={3}
          />
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
          disabled={loading}
        >
          {loading ? '⏳ Menyimpan.. .' : '✓ Simpan'}
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
