import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const CallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleOAuthCallback } = useAuth();

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        console.log('🔍 [CallbackPage] URL:', window.location.href);
        console.log('🔍 [CallbackPage] Search params:', Object.fromEntries(searchParams.entries()));

        // Get params from URL
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        const state = searchParams.get('state');

        console.log('🔍 [CallbackPage] Extracted params:', { code, errorParam, state });

        // Check for OAuth errors
        if (errorParam) {
          let errorMessage = errorDescription || errorParam;
          
          if (errorParam === 'invalid_scope') {
            errorMessage = 'Scope yang diminta tidak valid. Hubungi administrator.';
          } else if (errorParam === 'access_denied') {
            errorMessage = 'Anda menolak memberikan akses. Silakan coba lagi.';
          }
          
          throw new Error(errorMessage);
        }

        // Check if code exists
        if (!code) {
          throw new Error('Authorization code tidak ditemukan di URL');
        }

        // Verify state (CSRF protection)
        const savedState = sessionStorage.getItem('oauth_state');
        console.log('🔍 [CallbackPage] State check:', { savedState, receivedState: state });

        if (!savedState || savedState !== state) {
          throw new Error('Invalid state parameter. Kemungkinan CSRF attack.');
        }

        // Get flow type (login or register)
        const flowType = sessionStorage.getItem('oauth_flow') || 'login';
        const isRegister = flowType === 'register';

        console.log(`✅ [CallbackPage] Processing ${flowType} with code:`, code.substring(0, 20) + '...');

        // Handle OAuth callback
        const result = await handleOAuthCallback(code, isRegister);

        console.log('✅ [CallbackPage] Callback result:', result);

        if (result.success) {
          setStatus('success');
          
          // Clear session storage
          sessionStorage.removeItem('oauth_state');
          sessionStorage.removeItem('oauth_flow');
          
          // Redirect after 2 seconds
          setTimeout(() => {
            navigate('/');
          }, 2000);
        } else {
          throw new Error(result.error || 'Authentication failed');
        }

      } catch (err: any) {
        console.error('❌ [CallbackPage] Error:', err);
        setError(err.message || 'Terjadi kesalahan yang tidak diketahui');
        setStatus('error');
      }
    };

    // Only run once when component mounts
    processCallback();
  }, [searchParams, navigate, handleOAuthCallback]);

  // Render based on status
  if (status === 'processing') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '48px',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '450px',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 24px',
            border: '4px solid #e5e7eb',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          <h2 style={{ 
            margin: '0 0 12px', 
            fontSize: '24px', 
            fontWeight: 600,
            color: '#111827' 
          }}>
            Memproses Autentikasi
          </h2>
          <p style={{ 
            margin: 0, 
            color: '#6b7280', 
            fontSize: '14px' 
          }}>
            Mohon tunggu sebentar, kami sedang menghubungkan akun Anda...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '48px',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '450px',
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 24px',
            backgroundColor: '#10b981',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg 
              style={{ width: '48px', height: '48px', color: 'white' }}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={3} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
          </div>
          <h2 style={{ 
            margin: '0 0 12px', 
            fontSize: '24px', 
            fontWeight: 600,
            color: '#111827' 
          }}>
            Berhasil!
          </h2>
          <p style={{ 
            margin: '0 0 8px', 
            color: '#6b7280', 
            fontSize: '14px' 
          }}>
            Akun Accurate berhasil terhubung
          </p>
          <p style={{ 
            margin: 0, 
            color: '#9ca3af', 
            fontSize: '13px' 
          }}>
            Mengalihkan ke dashboard...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '48px',
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        maxWidth: '500px',
        width: '100%',
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          margin: '0 auto 24px',
          backgroundColor: '#fee2e2',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg 
            style={{ width: '48px', height: '48px', color: '#dc2626' }}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M6 18L18 6M6 6l12 12" 
            />
          </svg>
        </div>

        <h2 style={{ 
          margin: '0 0 12px', 
          fontSize: '24px', 
          fontWeight: 600,
          color: '#111827',
          textAlign: 'center' 
        }}>
          Autentikasi Gagal
        </h2>

        <div style={{
          padding: '16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          marginBottom: '24px',
        }}>
          <p style={{ 
            margin: 0, 
            color: '#991b1b', 
            fontSize: '14px',
            lineHeight: '1.5',
            wordBreak: 'break-word' 
          }}>
            {error}
          </p>
        </div>

        <div style={{ 
          display: 'flex', 
          gap: '12px',
          flexDirection: 'column' 
        }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '12px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Kembali ke Login
          </button>
          
          <button
            onClick={() => {
              sessionStorage.clear();
              window.location.reload();
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Coba Lagi
          </button>
        </div>

        <details style={{ 
          marginTop: '24px', 
          fontSize: '12px', 
          color: '#6b7280' 
        }}>
          <summary style={{ 
            cursor: 'pointer', 
            fontWeight: 500,
            marginBottom: '8px' 
          }}>
            Troubleshooting
          </summary>
          <ul style={{ 
            margin: 0, 
            paddingLeft: '20px',
            lineHeight: '1.6' 
          }}>
            <li>Pastikan Anda menggunakan akun Accurate yang valid</li>
            <li>Cek koneksi internet Anda</li>
            <li>Hapus cache browser dan coba lagi</li>
            <li>Pastikan scope OAuth sudah benar di konfigurasi</li>
          </ul>
        </details>
      </div>
    </div>
  );
};