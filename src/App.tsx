import React, { useState } from 'react';
import { BudgetPage } from './pages/BudgetPage';
import { RealisasiPage } from './pages/RealisasiPage';
import { AccurateSync } from './pages/SettingsPage';

type PageType = 'budget' | 'realisasi' | 'settings';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('budget');

 return (
    <div className="fade-in">
      {/* Navigation menggunakan class nav-tabs dari CSS Global */}
      <nav style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem' }}>
        <div className="app-container" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="flex-center gap-2">
            <div style={{ fontSize: '1.5rem' }}>💼</div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Budget System</h1>
          </div>
          
          <div className="nav-tabs" style={{ marginBottom: 0, boxShadow: 'none' }}>
            <button
              onClick={() => setCurrentPage('budget')}
              className={`nav-tab ${currentPage === 'budget' ? 'active' : ''}`}
            >
              📊 Budget
            </button>
            <button
              onClick={() => setCurrentPage('realisasi')}
              className={`nav-tab ${currentPage === 'realisasi' ? 'active' : ''}`}
            >
              📈 Realisasi
            </button>
            <button
              onClick={() => setCurrentPage('settings')}
              className={`nav-tab ${currentPage === 'settings' ? 'active' : ''}`}
            >
              ⚙️ Sinkronisasi
            </button>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main>
        {currentPage === 'budget' && <BudgetPage />}
        {currentPage === 'realisasi' && <RealisasiPage />}
        {currentPage === 'settings' && <AccurateSync />}
      </main>
    </div>
  );
}