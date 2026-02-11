import React, { useState, useEffect } from 'react';
import styles from './AuthGuide.module.css';

type GuideSection = 'login' | 'register' | 'google' | 'reset';

const Icons = {
  login: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
      <polyline points="10 17 15 12 10 7"/>
      <line x1="15" y1="12" x2="3" y2="12"/>
    </svg>
  ),
  register: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  google: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  reset: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
};

export const AuthGuide: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [activeSection, setActiveSection] = useState<GuideSection>('login');

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

  const sections: { key: GuideSection; label: string }[] = [
    { key: 'login',    label: 'Login' },
    { key: 'register', label: 'Daftar Akun' },
    { key: 'google',   label: 'Login Google' },
    { key: 'reset',    label: 'Reset Password' },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={styles.triggerButton}
        title="Panduan Login dan Daftar Akun "
      >
        <span className={styles.triggerIcon}>?</span>
        <span className={styles.triggerText}>Panduan</span>
      </button>

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>Panduan Login dan Daftar Akun</h2>
                <p className={styles.modalSubtitle}>Sistem Manajemen Budget & Realisasi</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className={styles.closeButton}
                aria-label="Tutup panduan"
              >
                ×
              </button>
            </div>

            {/* Tab Navigation */}
            <div className={styles.tabNav}>
              {sections.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setActiveSection(s.key)}
                  className={`${styles.tabButton} ${activeSection === s.key ? styles.tabButtonActive : ''}`}
                >
                  {Icons[s.key]}
                  <span>{s.label}</span>
                </button>
              ))}
            </div>

            {/* Body */}
            <div className={styles.modalBody}>

              {/* ===== LOGIN ===== */}
              {activeSection === 'login' && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionIconBox}>{Icons.login}</div>
                    <h3 className={styles.sectionTitle}>Cara Login dengan Email & Password</h3>
                  </div>

                  <div className={styles.step}>
                    <div className={`${styles.stepNumber} ${styles.blue}`}>1</div>
                    <div className={styles.stepContent}>
                      <h4>Masukkan Email</h4>
                      <p>Isi kolom <strong>Email</strong> dengan alamat email yang terdaftar di sistem ini.</p>
                    </div>
                  </div>

                  <div className={styles.step}>
                    <div className={`${styles.stepNumber} ${styles.blue}`}>2</div>
                    <div className={styles.stepContent}>
                      <h4>Masukkan Password</h4>
                      <p>Isi kolom <strong>Password</strong> dengan password akun Anda. Gunakan ikon mata untuk menampilkan atau menyembunyikan password.</p>
                    </div>
                  </div>

                  <div className={styles.step}>
                    <div className={`${styles.stepNumber} ${styles.blue}`}>3</div>
                    <div className={styles.stepContent}>
                      <h4>Klik Tombol Login</h4>
                      <p>Tekan tombol <strong>Login</strong> untuk masuk ke sistem. Anda akan diarahkan ke halaman utama secara otomatis.</p>
                    </div>
                  </div>

                  <div className={styles.infoBox}>
                    <strong>Tips:</strong> Pastikan tidak ada spasi di awal atau akhir email dan password Anda.
                  </div>
                </div>
              )}

              {/* ===== REGISTER ===== */}
              {activeSection === 'register' && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionIconBox}>{Icons.register}</div>
                    <h3 className={styles.sectionTitle}>Cara Mendaftar Akun Baru</h3>
                  </div>

                  <div className={styles.step}>
                    <div className={`${styles.stepNumber} ${styles.blue}`}>1</div>
                    <div className={styles.stepContent}>
                      <h4>Klik "Daftar" di Bagian Bawah</h4>
                      <p>Pada halaman login, klik tautan <strong>Daftar</strong> di bagian bawah form untuk beralih ke form registrasi.</p>
                    </div>
                  </div>

                  <div className={styles.step}>
                    <div className={`${styles.stepNumber} ${styles.blue}`}>2</div>
                    <div className={styles.stepContent}>
                      <h4>Isi Nama Lengkap</h4>
                      <p>Masukkan nama lengkap Anda, minimal <strong>3 karakter</strong>.</p>
                    </div>
                  </div>

                  <div className={styles.step}>
                    <div className={`${styles.stepNumber} ${styles.blue}`}>3</div>
                    <div className={styles.stepContent}>
                      <h4>Isi Email & Password</h4>
                      <p>Gunakan alamat email aktif yang belum terdaftar. Password minimal <strong>6 karakter</strong>.</p>
                    </div>
                  </div>

                  <div className={styles.step}>
                    <div className={`${styles.stepNumber} ${styles.green}`}>4</div>
                    <div className={styles.stepContent}>
                      <h4>Konfirmasi Email</h4>
                      <p>Setelah mendaftar, cek inbox email Anda untuk tautan konfirmasi. Klik tautan tersebut untuk mengaktifkan akun.</p>
                    </div>
                  </div>

                  <div className={styles.warningBox}>
                    <strong>Penting:</strong> Pastikan email yang digunakan aktif dan dapat menerima email konfirmasi. Cek juga folder <strong>Spam</strong> jika email tidak masuk ke inbox.
                  </div>
                </div>
              )}

              {/* ===== GOOGLE ===== */}
              {activeSection === 'google' && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionIconBox}>{Icons.google}</div>
                    <h3 className={styles.sectionTitle}>Cara Login dengan Google</h3>
                  </div>

                  <div className={styles.step}>
                    <div className={`${styles.stepNumber} ${styles.blue}`}>1</div>
                    <div className={styles.stepContent}>
                      <h4>Klik Tombol "Login dengan Google"</h4>
                      <p>Di bagian bawah form, klik tombol <strong>Login dengan Google</strong> (atau <strong>Daftar dengan Google</strong> jika belum punya akun).</p>
                    </div>
                  </div>

                  <div className={styles.step}>
                    <div className={`${styles.stepNumber} ${styles.blue}`}>2</div>
                    <div className={styles.stepContent}>
                      <h4>Pilih Akun Google</h4>
                      <p>Browser akan membuka popup Google. Pilih atau masukkan akun Google yang ingin digunakan.</p>
                    </div>
                  </div>

                  <div className={styles.step}>
                    <div className={`${styles.stepNumber} ${styles.green}`}>3</div>
                    <div className={styles.stepContent}>
                      <h4>Izinkan Akses</h4>
                      <p>Setujui izin akses yang diminta, lalu Anda akan diarahkan kembali ke sistem secara otomatis.</p>
                    </div>
                  </div>

                  <div className={styles.infoBox}>
                    <strong>Tips:</strong> Login dengan Google lebih cepat dan tidak memerlukan password tambahan. Pastikan popup tidak diblokir browser Anda.
                  </div>
                </div>
              )}

              {/* ===== RESET PASSWORD ===== */}
              {activeSection === 'reset' && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionIconBox}>{Icons.reset}</div>
                    <h3 className={styles.sectionTitle}>Cara Reset Password</h3>
                  </div>

                  <div className={styles.step}>
                    <div className={`${styles.stepNumber} ${styles.blue}`}>1</div>
                    <div className={styles.stepContent}>
                      <h4>Klik "Lupa Password?"</h4>
                      <p>Di halaman login, klik tautan <strong>Lupa password?</strong> yang ada di bawah kolom password.</p>
                    </div>
                  </div>

                  <div className={styles.step}>
                    <div className={`${styles.stepNumber} ${styles.blue}`}>2</div>
                    <div className={styles.stepContent}>
                      <h4>Masukkan Email Terdaftar</h4>
                      <p>Isi kolom email dengan alamat email yang terdaftar di sistem, lalu klik <strong>Kirim Link Reset</strong>.</p>
                    </div>
                  </div>

                  <div className={styles.step}>
                    <div className={`${styles.stepNumber} ${styles.blue}`}>3</div>
                    <div className={styles.stepContent}>
                      <h4>Cek Email</h4>
                      <p>Buka email Anda dan cari pesan dari sistem. Klik tautan <strong>Reset Password</strong> di dalam email tersebut.</p>
                    </div>
                  </div>

                  <div className={styles.step}>
                    <div className={`${styles.stepNumber} ${styles.green}`}>4</div>
                    <div className={styles.stepContent}>
                      <h4>Buat Password Baru</h4>
                      <p>Masukkan password baru Anda, lalu simpan. Setelah itu Anda bisa login dengan password baru.</p>
                    </div>
                  </div>

                  <div className={styles.warningBox}>
                    <strong>Penting:</strong> Link reset password hanya berlaku selama <strong>1 jam</strong>. Jika sudah kadaluarsa, ulangi proses dari awal.
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className={styles.modalFooter}>
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