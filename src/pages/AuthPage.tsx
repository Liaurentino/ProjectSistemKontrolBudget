import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAuthorizationUrl, exchangeCodeForToken } from '../lib/accurateAuth';

export const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');

  useEffect(() => {
    if (code) {
      exchangeCodeForToken(code).then(({ data, error }) => {
        if (error) {
          alert('Authorization failed');
          return;
        }
        alert('Successfully authorized!');
        window.location.href = '/budget';
      });
    }
  }, [code]);

  const handleLogin = () => {
    const authUrl = getAuthorizationUrl();
    window.location.href = authUrl;
  };

  return (
    <div className="modal-overlay">
      <div className="card fade-in text-center" style={{ maxWidth: '500px' }}>
        <div className="app-header flex-center" style={{ width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 1.5rem' }}>
          <span className="icon">💼</span>
        </div>
        
        <h1 className="card-title mb-2" style={{ fontSize: '2rem' }}>
          Budget Allocation System
        </h1>
        
        <p className="mb-4" style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
          Authorize dengan Accurate Online untuk melanjutkan
        </p>
        
        <button
          onClick={handleLogin}
          className="btn btn-primary"
          style={{ width: '100%', padding: '1rem' }}
        >
          🔐 Login dengan Accurate
        </button>

        <div className="alert alert-info mt-3 text-left">
          <strong>ℹ️ Catatan:</strong> Anda akan diarahkan ke halaman login Accurate Online untuk autentikasi
        </div>
      </div>
    </div>
  );
};