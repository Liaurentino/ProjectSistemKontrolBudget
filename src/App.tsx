import React, { useState } from 'react';
import { BudgetPage } from './pages/BudgetPage';
import { RealisasiPage } from './pages/RealisasiPage';
import { AccurateSync } from './pages/SettingsPage';

type PageType = 'budget' | 'realisasi' | 'settings';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('budget');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-md">
        <div className="max-w-6xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                💼
              </div>
              <h1 className="text-xl font-bold text-gray-800">Budget Allocation System</h1>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setCurrentPage('budget')}
                className={`px-4 py-2 rounded-lg font-semibold transition text-sm ${
                  currentPage === 'budget'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                📊 Budget
              </button>
              <button
                onClick={() => setCurrentPage('realisasi')}
                className={`px-4 py-2 rounded-lg font-semibold transition text-sm ${
                  currentPage === 'realisasi'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                📈 Realisasi
              </button>
              <button
                onClick={() => setCurrentPage('settings')}
                className={`px-4 py-2 rounded-lg font-semibold transition text-sm ${
                  currentPage === 'settings'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                ⚙️ Sinkronisasi
              </button>
            </div>
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