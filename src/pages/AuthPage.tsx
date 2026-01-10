import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getAuthorizationUrl, exchangeCodeForToken } from '../lib/accurateMiddleware';

export const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code');

  useEffect(() => {
    if (!code) return;

    exchangeCodeForToken(code).then(({ error }) => {
      if (error) {
        alert('Authorization failed');
        return;
      }
      navigate('/budget', { replace: true });
    });
  }, [code, navigate]);

  return (
    <div className="page-center modal-overlay">
      <div className="card auth-modal">
        <div className="auth-icon">💼</div>

        <h1 className="auth-title">Budget Allocation System</h1>

        <p className="auth-subtitle">
          Authorize dengan Accurate Online untuk melanjutkan
        </p>

        <button
          onClick={() => (window.location.href = getAuthorizationUrl())}
          className="btn btn-primary btn-full"
        >
          Login dengan Accurate
        </button>

        <div className="alert alert-info mt-3">
          Anda akan diarahkan ke halaman login Accurate Online
        </div>
      </div>
    </div>
  );
};
