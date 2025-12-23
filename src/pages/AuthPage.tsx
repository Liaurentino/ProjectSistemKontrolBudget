import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAuthorizationUrl, exchangeCodeForToken } from '../lib/accurateAuth';

export const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');

  useEffect(() => {
    if (code) {
      // User baru redirect dari Accurate, exchange code
      exchangeCodeForToken(code).then(({ data, error }) => {
        if (error) {
          alert('Authorization failed');
          return;
        }
        alert('Successfully authorized!');
        // Redirect ke dashboard
        window.location.href = '/budget';
      });
    }
  }, [code]);

  const handleLogin = () => {
    // Redirect ke Accurate authorization page
    const authUrl = getAuthorizationUrl();
    window.location.href = authUrl;
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <h1 className="text-2xl font-bold mb-4">Budget Allocation System</h1>
        <p className="text-gray-600 mb-6">
          Authorize dengan Accurate Online untuk melanjutkan
        </p>
        <button
          onClick={handleLogin}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
        >
          Login dengan Accurate
        </button>
      </div>
    </div>
  );
};