import React, { useState, useEffect } from 'react';
import styles from './AccurateGuide.module.css';

const APP_KEY = import.meta.env.VITE_ACCURATE_API_KEY;

export const AccurateGuide: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [copiedAppKey, setCopiedAppKey] = useState(false);

  const copyAppKey = () => {
    navigator.clipboard.writeText(APP_KEY);
    setCopiedAppKey(true);
    setTimeout(() => setCopiedAppKey(false), 2000);
  };

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
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={styles.triggerButton}
      >
        Panduan Lengkap Mendapatkan API Token Data Usaha
      </button>

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Panduan Mendapatkan API Token Data Usaha</h2>
              <button
                onClick={() => setShowModal(false)}
                className={styles.closeButton}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.appKeyBox}>
                <div>
                  <strong className={styles.appKeyLabel}>App Key BudgetControl Sistem</strong>
                </div>
                <div className={styles.appKeyValue}>{APP_KEY}</div>
                <button
                  onClick={copyAppKey}
                  className={`${styles.copyButton} ${copiedAppKey ? styles.copied : ''}`}
                >
                  {copiedAppKey ? '✓ Tersalin!' : '📋 Salin App Key'}
                </button>
              </div>

              <div>
                <h3 className={styles.stepsTitle}>Langkah-langkah:</h3>

                {/* Step 1 */}
                <div className={styles.step}>
                  <div className={`${styles.stepNumber} ${styles.stepNumberBlue}`}>1</div>
                  <div className={styles.stepContent}>
                    <h4>Login ke Akun Accurate Anda</h4>
                    <p>
                      Buka{' '}
                      <a
                        href="https://accurate.id"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#2196f3', textDecoration: 'none' }}
                      >
                        accurate.id
                      </a>{' '}
                      dan login dengan akun Anda
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className={styles.step}>
                  <div className={`${styles.stepNumber} ${styles.stepNumberBlue}`}>2</div>
                  <div className={styles.stepContent}>
                    <h4>Pilih Data Usaha yang Ingin Disambungkan</h4>
                    <p>Pilih database/data usaha yang akan dihubungkan dengan BudgetControl Sistem</p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className={styles.step}>
                  <div className={`${styles.stepNumber} ${styles.stepNumberBlue}`}>3</div>
                  <div className={styles.stepContent}>
                    <h4>Buka Menu Pengaturan → Accurate Store</h4>
                    <p>
                      Pada menu navigasi, pilih <strong>Pengaturan</strong>, lalu pilih <strong>Accurate Store</strong>
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className={styles.step}>
                  <div className={`${styles.stepNumber} ${styles.stepNumberOrange}`}>4</div>
                  <div className={styles.stepContent}>
                    <h4>Install Aplikasi BudgetControl Sistem</h4>
                    <p>
                      Pilih menu <strong>Aplikasi Saya</strong>, lalu install aplikasi <strong>BudgetControl Sistem</strong> dengan mengisikan App Key di atas
                    </p>
                  </div>
                </div>

                {/* Step 5 */}
                <div className={styles.step}>
                  <div className={`${styles.stepNumber} ${styles.stepNumberBlue}`}>5</div>
                  <div className={styles.stepContent}>
                    <h4>Buka Menu API Token</h4>
                    <p>
                      Setelah aplikasi terinstall, pilih menu <strong>API Token</strong> dan klik <strong>Buat API Token</strong>
                    </p>
                  </div>
                </div>

                {/* Step 6 */}
                <div className={styles.step}>
                  <div className={`${styles.stepNumber} ${styles.stepNumberBlue}`}>6</div>
                  <div className={styles.stepContent}>
                    <h4>Generate API Token untuk BudgetControl Sistem</h4>
                    <p>
                      Pilih aplikasi <strong>BudgetControl Sistem</strong>, kemudian klik <strong>Buat API Token</strong>
                    </p>
                  </div>
                </div>

                {/* Step 7 */}
                <div className={styles.step}>
                  <div className={`${styles.stepNumber} ${styles.stepNumberGreen}`}>7</div>
                  <div className={styles.stepContent}>
                    <h4>Salin API Token ke Form</h4>
                    <p>
                      Salin API Token yang dihasilkan dan paste ke kolom <strong>API Token</strong> di form ini, lalu klik <strong>Validasi Token</strong>
                    </p>
                  </div>
                </div>
              </div>

              <div className={styles.warningBox}>
                <strong className={styles.warningTitle}>Penting!</strong>
                <p className={styles.warningText}>
                  • API Token bersifat rahasia, jangan bagikan kepada siapapun<br />
                  • Pastikan email akun Accurate Anda sama dengan email login sistem ini<br />
                  • Token harus divalidasi terlebih dahulu sebelum dapat disimpan
                </p>
              </div>

                <button
                onClick={() => setShowModal(false)}
                className={styles.footerButton}
              >
                Mengerti, Tutup Panduan
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};