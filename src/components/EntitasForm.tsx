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
  });

  const [loading, setLoading] = useState(false);

  /* isi data saat edit */
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData({
        entity_name: initialData.entity_name || '',
        description: initialData.description || '',
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
        >
          Batal
        </button>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
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
