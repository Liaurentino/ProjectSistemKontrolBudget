import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';
import styles from './AccurateOauthCallbak.module.css';

interface Database {
  id: number;
  name: string;
  alias?: string;
}

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  user: {
    email: string;
    name: string;
  };
}

export default function AccurateOAuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Menghubungkan dengan Accurate...');
  const [error, setError] = useState('');
  
  // Database selection
  const [databases, setDatabases] = useState<Database[]>([]);
  const [selectedDbId, setSelectedDbId] = useState<number | null>(null);
  const [showDbSelection, setShowDbSelection] = useState(false);
  
  // Token & user data
  const [tokenData, setTokenData] = useState<TokenData | null>(null);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // ========================================
      // 1. VALIDASI CALLBACK PARAMETERS
      // ========================================
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const errorParam = params.get('error');
      const errorDescription = params.get('error_description');

      // Handle user cancelled/denied access
      if (errorParam) {
        if (errorParam === 'access_denied') {
          setError('Login dibatalkan. Anda harus memberikan izin untuk melanjutkan.');
          console.log('[Callback] User denied access');
          return;
        }
        throw new Error(errorDescription || `OAuth error: ${errorParam}`);
      }

      if (!code || !state) {
        throw new Error('Invalid callback - missing code or state');
      }

      // Verify CSRF state
      const savedState = localStorage.getItem('accurate_oauth_state');
      const savedTimestamp = localStorage.getItem('accurate_oauth_timestamp');

      if (!savedState || savedState !== state) {
        throw new Error('Invalid state - possible CSRF attack detected');
      }

      // Check timestamp (max 10 minutes)
      if (savedTimestamp) {
        const elapsed = Date.now() - parseInt(savedTimestamp);
        if (elapsed > 10 * 60 * 1000) {
          throw new Error('OAuth session expired - please try again');
        }
      }

      console.log('[Callback] ✅ State verified');

      // ========================================
      // 2. EXCHANGE CODE FOR TOKEN
      // ========================================
      setStatus('Menukar authorization code...');

      const { data: tokenResponse, error: tokenError } = await supabase.functions.invoke(
        'accurate-oauth',
        { 
          body: { code } 
        }
      );

      if (tokenError) {
        console.error('[Callback] Token error:', tokenError);
        throw new Error(tokenError.message || 'Failed to exchange code for token');
      }

      if (!tokenResponse?.access_token) {
        throw new Error('No access token received from Accurate');
      }

      console.log('[Callback] ✅ Token received');
      console.log('[Callback] User:', tokenResponse.user?.email);

      // Simpan token data
      setTokenData(tokenResponse);

      // ========================================
      // 3. GET DATABASE LIST
      // ========================================
      setStatus('Mengambil daftar database...');

      const { data: dbResponse, error: dbError } = await supabase.functions.invoke(
        'accurate-oauth',
        { 
          body: { 
            accessToken: tokenResponse.access_token 
          } 
        }
      );

      if (dbError) {
        console.error('[Callback] Database list error:', dbError);
        throw new Error(dbError.message || 'Failed to get database list');
      }

      if (!dbResponse?.databases || dbResponse.databases.length === 0) {
        throw new Error('Tidak ada database ditemukan di akun Accurate Anda');
      }

      console.log('[Callback] ✅ Found', dbResponse.databases.length, 'databases');

      // ========================================
      // 4. SHOW DATABASE SELECTION
      // ========================================
      setDatabases(dbResponse.databases);
      setShowDbSelection(true);
      setStatus('Pilih database Accurate Anda');

      // Clean up localStorage
      localStorage.removeItem('accurate_oauth_state');
      localStorage.removeItem('accurate_oauth_timestamp');

    } catch (err: any) {
      console.error('[Callback] Error:', err);
      setError(err.message || 'Login dengan Accurate gagal');
      
      // Clean up localStorage on error
      localStorage.removeItem('accurate_oauth_state');
      localStorage.removeItem('accurate_oauth_timestamp');
    }
  };

  const handleDatabaseSelect = async () => {
    if (!selectedDbId || !tokenData) {
      setError('Silakan pilih database');
      return;
    }

    try {
      setShowDbSelection(false);
      setStatus('Menyimpan konfigurasi...');

      const selectedDb = databases.find(db => db.id === selectedDbId);
      if (!selectedDb) {
        throw new Error('Database tidak ditemukan');
      }

      console.log('[Callback] Selected database:', selectedDb.name);

      // ========================================
      // 5. CHECK EXISTING USER SESSION
      // ========================================
      const { data: { user: existingUser } } = await supabase.auth.getUser();

      let userId: string;
      let isNewUser = false;

      if (existingUser) {
        // User sudah login
        userId = existingUser.id;
        console.log('[Callback] ✅ User already logged in:', existingUser.email);
      } else {
        // ========================================
        // 6. CREATE NEW USER
        // ========================================
        setStatus('Membuat akun...');

        // Generate random password (user tidak perlu tahu)
        const randomPassword = crypto.randomUUID();

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: tokenData.user.email,
          password: randomPassword,
          options: {
            data: {
              full_name: tokenData.user.name,
              auth_method: 'accurate_oauth',
            },
            emailRedirectTo: `${window.location.origin}/dashboard`
          }
        });

        if (signUpError) {
          if (signUpError.message.includes('already registered')) {
            // Email sudah ada tapi user belum login
            console.log('[Callback] Email exists, sending magic link...');
            
            await supabase.auth.signInWithOtp({
              email: tokenData.user.email,
              options: { 
                shouldCreateUser: false,
                emailRedirectTo: `${window.location.origin}/dashboard`
              }
            });

            alert(
              `Email ${tokenData.user.email} sudah terdaftar.\n\n` +
              `Link login telah dikirim ke email Anda.\n` +
              `Setelah login, Anda dapat menghubungkan Accurate di pengaturan.`
            );
            
            navigate('/login');
            return;
          }
          throw signUpError;
        }

        if (!signUpData.user) {
          throw new Error('Failed to create user account');
        }

        userId = signUpData.user.id;
        isNewUser = true;
        console.log('[Callback] ✅ New user created:', tokenData.user.email);
      }

      // ========================================
      // 7. SAVE OAUTH TOKENS TO DATABASE
      // ========================================
      setStatus('Menyimpan token OAuth...');

      const expiresAt = new Date(
        Date.now() + (tokenData.expires_in || 1296000) * 1000
      );

      const { error: tokenSaveError } = await supabase
        .from('accurate_oauth_tokens')
        .upsert({
          user_id: userId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt.toISOString(),
          scope: tokenData.scope || '',
          accurate_email: tokenData.user.email,
          accurate_name: tokenData.user.name,
          database_id: selectedDb.id,
          database_name: selectedDb.name,
          database_alias: selectedDb.alias || null
        }, { 
          onConflict: 'user_id' 
        });

      if (tokenSaveError) {
        console.error('[Callback] Error saving token:', tokenSaveError);
        throw new Error(`Failed to save OAuth token: ${tokenSaveError.message}`);
      }

      console.log('[Callback] ✅ OAuth tokens saved to database');

      // ========================================
      // 8. REDIRECT TO DASHBOARD
      // ========================================
      setStatus('Berhasil! Mengalihkan ke dashboard...');
      
      setTimeout(() => {
        if (isNewUser) {
          navigate('/mode-selection'); // New users choose mode
        } else {
          navigate('/dashboard'); // Existing users go to dashboard
        }
      }, 1000);

    } catch (err: any) {
      console.error('[Callback] Error saving config:', err);
      setError(err.message || 'Gagal menyimpan konfigurasi Accurate');
    }
  };

  // ========================================
  // RENDER: DATABASE SELECTION
  // ========================================
  if (showDbSelection && tokenData) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h2 className={styles.title}>Pilih Database Accurate</h2>
          <p className={styles.subtitle}>
            Akun: <strong>{tokenData.user.email}</strong>
          </p>

          <div className={styles.databaseList}>
            {databases.map((db) => (
              <label key={db.id} className={styles.databaseOption}>
                <input
                  type="radio"
                  name="database"
                  value={db.id}
                  checked={selectedDbId === db.id}
                  onChange={() => setSelectedDbId(db.id)}
                  className={styles.radio}
                />
                <div className={styles.databaseInfo}>
                  <div className={styles.databaseName}>{db.name}</div>
                  {db.alias && (
                    <div className={styles.databaseAlias}>{db.alias}</div>
                  )}
                </div>
              </label>
            ))}
          </div>

          <button
            onClick={handleDatabaseSelect}
            disabled={!selectedDbId}
            className={styles.selectButton}
          >
            Lanjutkan
          </button>

          <button
            onClick={() => navigate('/login')}
            className={styles.cancelButton}
          >
            Batal
          </button>
        </div>
      </div>
    );
  }

  // ========================================
  // RENDER: LOADING OR ERROR
  // ========================================
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {error ? (
          <>
            <div className={styles.errorIcon}>⚠️</div>
            <h2 className={styles.errorTitle}>
              {error.includes('dibatalkan') ? 'Login Dibatalkan' : 'Login Gagal'}
            </h2>
            <p className={styles.errorMessage}>{error}</p>
            
            <button 
              onClick={() => navigate('/login')} 
              className={styles.backButton}
            >
              {error.includes('dibatalkan') ? 'Coba Lagi' : 'Kembali ke Login'}
            </button>
          </>
        ) : (
          <>
            <Loader2 className={styles.spinner} size={48} />
            <h2 className={styles.title}>{status}</h2>
            <p className={styles.subtitle}>Mohon tunggu...</p>
          </>
        )}
      </div>
    </div>
  );
}