import React, { useState, useEffect } from 'react';
import styles from './CoaGuide.module.css';

export const CoaGuide: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'accurate' | 'excel'>('accurate');

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
        Panduan Import COA
      </button>

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Panduan Import Chart of Accounts</h2>
              <button
                onClick={() => setShowModal(false)}
                className={styles.closeButton}
              >
                ×
              </button>
            </div>

            {/* TABS */}
            <div className={styles.tabsContainer}>
              <button
                onClick={() => setActiveTab('accurate')}
                className={`${styles.tabButton} ${activeTab === 'accurate' ? styles.tabButtonActive : ''}`}
              >
                Import dari Accurate API
              </button>
              <button
                onClick={() => setActiveTab('excel')}
                className={`${styles.tabButton} ${activeTab === 'excel' ? styles.tabButtonActive : ''}`}
              >
                Import dari Excel
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* TAB 1: IMPORT FROM ACCURATE API */}
              {activeTab === 'accurate' && (
                <div className={styles.tabContent}>
                  <h3 className={styles.contentTitle}>Import COA dari Accurate Online</h3>
                  
                  <div className={styles.stepsContainer}>
                    {/* Step 1 */}
                    <div className={styles.step}>
                      <div className={`${styles.stepNumber} ${styles.stepNumberBlue}`}>1</div>
                      <div className={styles.stepContent}>
                        <h4>Pastikan API Token Sudah Terhubung</h4>
                        <p>
                          Anda harus sudah menghubungkan API Token Data Usaha Accurate di halaman <strong>Manajemen Entitas</strong>. 
                          Jika belum, silakan ke halaman Entitas terlebih dahulu.
                        </p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className={styles.step}>
                      <div className={`${styles.stepNumber} ${styles.stepNumberBlue}`}>2</div>
                      <div className={styles.stepContent}>
                        <h4>Pastikan COA Sudah Ada di Accurate Online</h4>
                        <p>
                          Login ke <strong>Accurate Online</strong>, buka menu <strong>Daftar</strong> → <strong>Akun Perkiraan</strong>. 
                          Pastikan Chart of Accounts Anda sudah dibuat atau sudah ada di sistem Accurate.
                        </p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className={styles.step}>
                      <div className={`${styles.stepNumber} ${styles.stepNumberOrange}`}>3</div>
                      <div className={styles.stepContent}>
                        <h4>Klik Tombol "Tarik dari Accurate API"</h4>
                        <p>
                          Pada halaman COA, klik tombol <strong>Import Data</strong> → <strong>Tarik dari Accurate API</strong>. 
                          Sistem akan mengambil seluruh data COA dari Accurate Online Anda.
                        </p>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className={styles.step}>
                      <div className={`${styles.stepNumber} ${styles.stepNumberBlue}`}>4</div>
                      <div className={styles.stepContent}>
                        <h4>Tunggu Proses Sinkronisasi</h4>
                        <p>
                          Proses sync membutuhkan waktu beberapa detik hingga beberapa menit tergantung jumlah akun. 
                          Jangan tutup halaman sampai proses selesai.
                        </p>
                      </div>
                    </div>

                    {/* Step 5 */}
                    <div className={styles.step}>
                      <div className={`${styles.stepNumber} ${styles.stepNumberGreen}`}>5</div>
                      <div className={styles.stepContent}>
                        <h4>Data COA Berhasil Dimuat</h4>
                        <p>
                          Setelah berhasil, data COA akan muncul di tabel. Anda dapat melihat Kode Akun, Nama Akun, Tipe, Saldo, dan Status.
                        </p>
                      </div>
                    </div>

                    {/* Step 6 */}
                    <div className={styles.step}>
                      <div className={`${styles.stepNumber} ${styles.stepNumberBlue}`}>6</div>
                      <div className={styles.stepContent}>
                        <h4>Edit Nama Akun dan Kode Akun (Opsional)</h4>
                        <p>
                          Anda hanya dapat mengedit <strong>Nama Akun</strong> dan <strong>Kode Akun</strong>. 
                          Field lainnya seperti Tipe, Saldo, dan Status bersifat <strong>read-only</strong> dari Accurate.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* WARNING BOX - REFRESH */}
                  <div className={styles.warningBox}>
                    <strong className={styles.warningTitle}>Penting!</strong>
                    <p className={styles.warningText}>
                      <strong>1.</strong> Tombol <strong>Refresh</strong> hanya akan memperbarui data yang diubah di tab <strong>Akun Perkiraan</strong> di Accurate Online.
                      <br />
                      <strong>2.</strong> Perubahan nilai saldo akibat <strong>transaksi</strong> (seperti pencatatan gaji, pembayaran, penerimaan, dll.) 
                      <strong> TIDAK akan otomatis ter-update</strong> melalui tombol Refresh.
                      <br />
                      <strong>3.</strong> Merubah nilai akibat <strong>transaksi</strong> harus dilakukan secara manual di tab <strong>Akun Perkiraan</strong> di Accurate Online, baru kemudian klik tombol Refresh.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: IMPORT FROM EXCEL */}
              {activeTab === 'excel' && (
                <div className={styles.tabContent}>
                  <h3 className={styles.contentTitle}>Import COA dari File Excel</h3>
                  
                  <div className={styles.stepsContainer}>
                    {/* Step 1 */}
                    <div className={styles.step}>
                      <div className={`${styles.stepNumber} ${styles.stepNumberBlue}`}>1</div>
                      <div className={styles.stepContent}>
                        <h4>Pastikan API Token Sudah Terhubung</h4>
                        <p>
                          Anda harus sudah menghubungkan API Token Data Usaha Accurate di halaman <strong>Manajemen Entitas</strong>. 
                          Jika belum, silakan ke halaman Entitas terlebih dahulu.
                        </p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className={styles.step}>
                      <div className={`${styles.stepNumber} ${styles.stepNumberOrange}`}>2</div>
                      <div className={styles.stepContent}>
                        <h4>Siapkan File Excel Sesuai Format</h4>
                        <p>
                          File Excel Anda harus mengikuti format yang benar. Pastikan header kolom dan data berada di baris yang sesuai. 
                          Download template Excel jika diperlukan.
                        </p>
                      </div>
                    </div>

                    {/* Step 3 - CRITICAL */}
                    <div className={styles.step}>
                      <div className={`${styles.stepNumber} ${styles.stepNumberRed}`}>3</div>
                      <div className={styles.stepContent}>
                        <h4>PENTING: Pastikan Kolom Tidak Miss-Align</h4>
                        <p>
                          <strong>Setiap kolom harus align dengan benar!</strong> Jangan ada cell yang di-merge atau melebar ke kolom lain.
                        </p>
                        <div className={styles.exampleBox}>
                          <div className={styles.exampleWrong}>
                            <strong>SALAH:</strong>
                            <br />
                            Header "Nama Akun" di 1 cell, tapi value-nya menggunakan 3 cell gabungan → TIDAK AKAN TERDETEKSI
                          </div>
                          <div className={styles.exampleCorrect}>
                            <strong>BENAR:</strong>
                            <br />
                            1 header = 1 value cell (align vertikal). Tidak ada merge cell di area data.
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className={styles.step}>
                      <div className={`${styles.stepNumber} ${styles.stepNumberBlue}`}>4</div>
                      <div className={styles.stepContent}>
                        <h4>Upload File Excel</h4>
                        <p>
                          Klik tombol <strong>Import Data</strong> → <strong>Import dari Excel</strong>. 
                          Kemudian drag & drop atau pilih file Excel Anda (.xlsx atau .xls).
                        </p>
                      </div>
                    </div>

                    {/* Step 5 */}
                    <div className={styles.step}>
                      <div className={`${styles.stepNumber} ${styles.stepNumberBlue}`}>5</div>
                      <div className={styles.stepContent}>
                        <h4>Tunggu Proses Import</h4>
                        <p>
                          Sistem akan memvalidasi dan mengimpor data dari Excel. Proses ini membutuhkan beberapa detik. 
                          Jika ada error, periksa format Excel Anda.
                        </p>
                      </div>
                    </div>

                    {/* Step 6 */}
                    <div className={styles.step}>
                      <div className={`${styles.stepNumber} ${styles.stepNumberGreen}`}>6</div>
                      <div className={styles.stepContent}>
                        <h4>Data COA Berhasil Dimuat</h4>
                        <p>
                          Setelah berhasil, data COA dari Excel akan muncul di tabel. 
                          Anda dapat mengedit <strong>Nama Akun</strong> dan <strong>Kode Akun</strong> sesuai kebutuhan.
                        </p>
                      </div>
                    </div>
                  </div>

                   {/* WARNING BOX - REFRESH */}
                  <div className={styles.warningBox}>
                    <strong className={styles.warningTitle}>Penting!</strong>
                    <p className={styles.warningText}>
                      <strong>1.</strong> Tombol <strong>Refresh</strong> hanya akan memperbarui data yang diubah di tab <strong>Akun Perkiraan</strong> di Accurate Online.
                      <br />
                      <strong>2.</strong> Perubahan nilai saldo akibat <strong>transaksi</strong> (seperti pencatatan gaji, pembayaran, penerimaan, dll.) 
                      <strong> TIDAK akan otomatis ter-update</strong> melalui tombol Refresh.
                      <br />
                      <strong>3.</strong> Merubah nilai akibat <strong>transaksi</strong> harus dilakukan secara manual di tab <strong>Akun Perkiraan</strong> di Accurate Online, baru kemudian klik tombol Refresh.
                    </p>
                  </div>
                </div>
              )}

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