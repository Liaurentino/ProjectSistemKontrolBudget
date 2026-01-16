// components/AccurateGuide.tsx

import React, { useState, useEffect } from 'react';

// Ambil App Key dari environment variable
const APP_KEY = import.meta.env.VITE_ACCURATE_API_KEY;

export const AccurateGuide: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [copiedAppKey, setCopiedAppKey] = useState(false);

  const copyAppKey = () => {
    navigator.clipboard.writeText(APP_KEY);
    setCopiedAppKey(true);
    setTimeout(() => setCopiedAppKey(false), 2000);
  };

  // Prevent scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal]);

  // Close modal on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false);
    };
    if (showModal) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showModal]);

  return (
    <>
      {/* Button/Link Trigger */}
      <button
        type="button"
        onClick={() => setShowModal(true)}
        style={{
          background: 'none',
          border: 'none',
          color: '#2196f3',
          textDecoration: 'underline',
          cursor: 'pointer',
          fontSize: '0.9rem',
          padding: 0,
          marginTop: '0.5rem',
          transition: 'color 0.2s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#1976d2')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#2196f3')}
      >
        Panduan Lengkap Mendapatkan API Token Data Usaha
      </button>

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
            animation: 'fadeIn 0.2s ease-out',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              maxWidth: '700px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'hidden',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              animation: 'slideUp 0.3s ease-out',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Fixed */}
            <div
              style={{
                padding: '1.5rem',
                borderBottom: '2px solid #e0e0e0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f5f5f5',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px',
                flexShrink: 0,
              }}
            >
              <h2 style={{ margin: 0, color: '#333', fontSize: '1.5rem' }}>
                Panduan Mendapatkan API Token Data Usaha 
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.8rem',
                  cursor: 'pointer',
                  color: '#666',
                  lineHeight: 1,
                  padding: '0.25rem',
                  transition: 'color 0.2s ease, transform 0.2s ease',
                  borderRadius: '4px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#f44336';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#666';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                ×
              </button>
            </div>

            {/* Content - Scrollable */}
            <div 
              style={{ 
                padding: '2rem',
                overflowY: 'auto',
                flex: 1,
              }}
            >
              {/* App Key Box */}
              <div
                style={{
                  backgroundColor: '#fff3e0',
                  border: '2px solid #ff9800',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#e65100', fontSize: '1rem' }}>
                    App Key BudgetControl Sistem
                  </strong>
                </div>
                <div
                  style={{
                    backgroundColor: '#fff',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '0.95rem',
                    color: '#333',
                    wordBreak: 'break-all',
                    border: '1px solid #ffb74d',
                    marginBottom: '0.75rem',
                  }}
                >
                  {APP_KEY}
                </div>
                <button
                  onClick={copyAppKey}
                  style={{
                    backgroundColor: copiedAppKey ? '#4caf50' : '#ff9800',
                    color: '#fff',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    if (!copiedAppKey) {
                      e.currentTarget.style.backgroundColor = '#f57c00';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!copiedAppKey) {
                      e.currentTarget.style.backgroundColor = '#ff9800';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  {copiedAppKey ? '✓ Tersalin!' : '📋 Salin App Key'}
                </button>
              </div>

              {/* Steps */}
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ color: '#333', marginBottom: '1rem', fontSize: '1.2rem' }}>
                  Langkah-langkah:
                </h3>

                {/* Step 1 */}
                <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
                  <div
                    style={{
                      minWidth: '40px',
                      height: '40px',
                      backgroundColor: '#2196f3',
                      color: '#fff',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      flexShrink: 0,
                    }}
                  >
                    1
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                      Login ke Akun Accurate Anda
                    </h4>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>
                      Buka <a href="https://accurate.id" target="_blank" rel="noopener noreferrer" style={{ color: '#2196f3', textDecoration: 'none', transition: 'color 0.2s' }}>accurate.id</a> dan login dengan akun Anda
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
                  <div
                    style={{
                      minWidth: '40px',
                      height: '40px',
                      backgroundColor: '#2196f3',
                      color: '#fff',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      flexShrink: 0,
                    }}
                  >
                    2
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                      Pilih Data Usaha yang Ingin Disambungkan
                    </h4>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>
                      Pilih database/data usaha yang akan dihubungkan dengan BudgetControl Sistem
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
                  <div
                    style={{
                      minWidth: '40px',
                      height: '40px',
                      backgroundColor: '#2196f3',
                      color: '#fff',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      flexShrink: 0,
                    }}
                  >
                    3
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                      Buka Menu Pengaturan → Accurate Store
                    </h4>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>
                      Pada menu navigasi, pilih <strong>Pengaturan</strong>, lalu pilih <strong>Accurate Store</strong>
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
                  <div
                    style={{
                      minWidth: '40px',
                      height: '40px',
                      backgroundColor: '#ff9800',
                      color: '#fff',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      flexShrink: 0,
                    }}
                  >
                    4
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                      Install Aplikasi BudgetControl Sistem
                    </h4>
                    <p style={{ margin: '0 0 0.5rem 0', color: '#666', fontSize: '0.95rem' }}>
                      Pilih menu <strong>Aplikasi Saya</strong>, lalu install aplikasi <strong>BudgetControl Sistem</strong> dengan mengisikan App Key di Atas
                    </p>
                  </div>
                </div>

                {/* Step 5 */}
                <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
                  <div
                    style={{
                      minWidth: '40px',
                      height: '40px',
                      backgroundColor: '#2196f3',
                      color: '#fff',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      flexShrink: 0,
                    }}
                  >
                    5
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                      Buka Menu API Token
                    </h4>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>
                      Setelah aplikasi terinstall, pilih menu <strong>API Token</strong> dan klik <strong>Buat API Token</strong>
                    </p>
                  </div>
                </div>

                {/* Step 6 */}
                <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
                  <div
                    style={{
                      minWidth: '40px',
                      height: '40px',
                      backgroundColor: '#2196f3',
                      color: '#fff',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      flexShrink: 0,
                    }}
                  >
                    6
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                      Generate API Token untuk BudgetControl Sistem
                    </h4>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>
                      Pilih aplikasi <strong>BudgetControl Sistem</strong>, kemudian klik <strong>Buat API Token</strong>
                    </p>
                  </div>
                </div>

                {/* Step 7 */}
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
                  <div
                    style={{
                      minWidth: '40px',
                      height: '40px',
                      backgroundColor: '#4caf50',
                      color: '#fff',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      flexShrink: 0,
                    }}
                  >
                    7
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                      Salin API Token ke Form
                    </h4>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>
                      Salin API Token yang dihasilkan dan paste ke kolom <strong>API Token</strong> di form ini, lalu klik <strong>Validasi Token</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Warning Box */}
              <div
                style={{
                  marginTop: '2rem',
                  padding: '1rem',
                  backgroundColor: '#ffebee',
                  border: '2px solid #f44336',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ color: '#c62828', display: 'block', marginBottom: '0.25rem' }}>
                      Penting!
                    </strong>
                    <p style={{ margin: 0, color: '#c62828', fontSize: '0.9rem', lineHeight: '1.5' }}>
                      • API Token bersifat rahasia, jangan bagikan kepada siapapun<br />
                      • Pastikan email akun Accurate Anda sama dengan email login sistem ini<br />
                      • Token harus divalidasi terlebih dahulu sebelum dapat disimpan
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - Fixed */}
            <div
              style={{
                padding: '1rem 2rem',
                borderTop: '1px solid #e0e0e0',
                display: 'flex',
                justifyContent: 'flex-end',
                backgroundColor: '#f9f9f9',
                borderBottomLeftRadius: '12px',
                borderBottomRightRadius: '12px',
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setShowModal(false)}
                style={{
                  backgroundColor: '#2196f3',
                  color: '#fff',
                  border: 'none',
                  padding: '0.75rem 2rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  transform: 'translateZ(0)',
                  backfaceVisibility: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1976d2';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(33, 150, 243, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#2196f3';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Mengerti, Tutup Panduan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Smooth scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
    </>
  );
};