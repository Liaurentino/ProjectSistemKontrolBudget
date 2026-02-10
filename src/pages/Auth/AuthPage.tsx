import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import styles from './AuthPage.module.css';

type ViewMode = 'login' | 'register' | 'forgot-password';

export default function AuthPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    fullName?: string;
  }>({});

  // ========================================
  // VALIDATION FUNCTIONS
  // ========================================

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return 'Email harus diisi';
    if (!emailRegex.test(email)) return 'Format email tidak valid';
    return '';
  };

  const validatePassword = (password: string) => {
    if (!password) return 'Password harus diisi';
    if (password.length < 6) return 'Password minimal 6 karakter';
    return '';
  };

  const validateFullName = (name: string) => {
    if (!name.trim()) return 'Nama lengkap harus diisi';
    if (name.trim().length < 3) return 'Nama minimal 3 karakter';
    return '';
  };

  const handleBlur = (field: 'email' | 'password' | 'fullName') => {
    const newErrors = { ...errors };
    
    if (field === 'email') {
      newErrors.email = validateEmail(email);
    } else if (field === 'password') {
      newErrors.password = validatePassword(password);
    } else if (field === 'fullName') {
      newErrors.fullName = validateFullName(fullName);
    }
    
    setErrors(newErrors);
  };

  // ========================================
  // CHECK EMAIL DUPLICATION
  // ========================================

  const checkEmailExists = async (email: string): Promise<boolean> => {
  try {
    console.log('[CheckEmail] Checking email:', email);
    
    const { data, error } = await supabase
      .rpc('is_email_registered', { email_input: email });

    if (error) {
      console.error('[CheckEmail] RPC Error:', error);
      throw error;
    }
    
    let result: boolean;
    
    if (Array.isArray(data)) {
      result = data[0] === true || data[0] === 't';
    } else if (typeof data === 'object' && data !== null) {
      result = data.value === true || data.value === 't';
    } else {
      result = data === true || data === 't';
    }

    console.log('[CheckEmail] Final result:', result);
    return result;
    
  } catch (err: any) {
    console.error('[CheckEmail] Error:', err);
    
    // Jika function belum dibuat, return false (fallback)
    if (err.message?.includes('function') || err.message?.includes('does not exist')) {
      console.warn('[CheckEmail] Function not found, skipping duplicate check');
      return false;
    }
    
    throw err;
  }
};
  // ========================================
  // GOOGLE OAUTH
  // ========================================

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    
    try {
      const baseUrl = import.meta.env.VITE_REDIRECT_URL || window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${baseUrl}/mode-selection`,
        },
      });
      
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Gagal login dengan Google');
      setLoading(false);
    }
  };

  // ========================================
  // FORGOT PASSWORD
  // ========================================

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const emailError = validateEmail(email);
    if (emailError) {
      setErrors({ email: emailError });
      return;
    }

    setLoading(true);

    try {
      const baseUrl = import.meta.env.VITE_REDIRECT_URL || window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${baseUrl}/reset-password`,
      });

      if (error) throw error;

      setMessage('Link reset password telah dikirim ke email Anda. Silakan cek inbox atau spam folder.');
      setEmail('');
    } catch (err: any) {
      console.error('[ForgotPassword] Error:', err);
      setError(err.message || 'Gagal mengirim email reset password');
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // LOGIN & REGISTER
  // ========================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    // Validasi semua field
    const newErrors: any = {};
    newErrors.email = validateEmail(email);
    newErrors.password = validatePassword(password);
    
    if (viewMode === 'register') {
      newErrors.fullName = validateFullName(fullName);
    }
    
    setErrors(newErrors);
    
    if (Object.values(newErrors).some(err => err !== '')) {
      return;
    }
    
    setLoading(true);

    try {
      if (viewMode === 'login') {
        // ========================================
        // LOGIN
        // ========================================
        console.log('[Login] Starting login for:', email);
        
        const { error } = await supabase.auth.signInWithPassword({ 
          email, 
          password 
        });
        
        if (error) throw error;
        
        setMessage('Login berhasil! Mengalihkan...');
        console.log('[Login] Success');
        
        setTimeout(() => {
          window.location.href = '/mode-selection';
        }, 800);
        
      } else {
        // ========================================
        // REGISTER
        // ========================================
        console.log('[Register] Starting registration process for:', email);

        // ✅ CEK DUPLIKASI EMAIL
        console.log('[Register] Checking for duplicate email...');
        const emailExists = await checkEmailExists(email);

        if (emailExists) {
          console.log('[Register] Email already registered:', email);
          setError('Email sudah terdaftar. Silakan login atau gunakan email lain.');
          setLoading(false);
          return;
        }

        console.log('[Register] Email available, proceeding with registration');

        // Lanjut register
        const baseUrl = import.meta.env.VITE_REDIRECT_URL || window.location.origin;
        
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { 
            data: { 
              full_name: fullName 
            },
            emailRedirectTo: `${baseUrl}/mode-selection`,
          },
        });

        console.log('[Register] Supabase response:', { 
          hasUser: !!data.user, 
          hasSession: !!data.session,
          error: error?.message 
        });

        if (error) {
          throw error;
        }

        // Check if email confirmation is required
        if (data.user && !data.session) {
          setMessage('Registrasi berhasil! Cek email Anda untuk konfirmasi akun.');
          console.log('[Register] Email confirmation required');
          
          // Clear form
          setEmail('');
          setPassword('');
          setFullName('');
          
        } else if (data.session) {
          setMessage('Registrasi berhasil! Mengalihkan...');
          console.log('[Register] Auto-login successful');
          
          setTimeout(() => {
            window.location.href = '/mode-selection';
          }, 800);
        }
      }
    } catch (err: any) {
      console.error('[Auth] Error:', err);
      
      let errorMessage = err.message || 'Terjadi kesalahan';
      
      // Handle specific errors
      if (errorMessage.includes('User already registered')) {
        errorMessage = 'Email sudah terdaftar. Silakan login.';
      } else if (errorMessage.includes('Invalid login credentials')) {
        errorMessage = 'Email atau password salah.';
      } else if (errorMessage.includes('Email rate limit exceeded')) {
        errorMessage = 'Terlalu banyak percobaan. Silakan coba lagi nanti.';
      } else if (errorMessage.includes('Password should be at least 6 characters')) {
        errorMessage = 'Password minimal 6 karakter.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // RENDER
  // ========================================

  const isLogin = viewMode === 'login';
  const isForgotPassword = viewMode === 'forgot-password';

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            {isLogin && 'Login'}
            {viewMode === 'register' && 'Registrasi'}
            {isForgotPassword && 'Lupa Password'}
          </h2>
          <p className={styles.subtitle}>
            Sistem manajemen budget dan realisasi
          </p>
        </div>

        {/* Alert */}
        {error && (
          <div className={styles.errorAlert}>
            {error}
          </div>
        )}

        {message && (
          <div className={styles.successAlert}>
            {message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={isForgotPassword ? handleForgotPassword : handleSubmit}>
          {viewMode === 'register' && (
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Nama Lengkap
              </label>
              <input
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) {
                    setErrors({ ...errors, fullName: '' });
                  }
                }}
                onBlur={() => handleBlur('fullName')}
                className={`${styles.input} ${errors.fullName ? styles.inputError : ''}`}
                disabled={loading}
                placeholder="Masukkan nama lengkap"
              />
              {errors.fullName && (
                <span className={styles.errorText}>
                  {errors.fullName}
                </span>
              )}
            </div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) {
                  setErrors({ ...errors, email: '' });
                }
              }}
              onBlur={() => handleBlur('email')}
              className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
              disabled={loading}
              placeholder="Masukkan email anda"
            />
            {errors.email && (
              <span className={styles.errorText}>
                {errors.email}
              </span>
            )}
          </div>

          {!isForgotPassword && (
            <div className={styles.formGroupPassword}>
              <label className={styles.label}>
                Password
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) {
                      setErrors({ ...errors, password: '' });
                    }
                  }}
                  onBlur={() => handleBlur('password')}
                  className={`${styles.passwordInput} ${errors.password ? styles.passwordInputError : ''}`}
                  disabled={loading}
                  placeholder="Masukkan password anda"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.togglePasswordButton}
                  disabled={loading}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <span className={styles.errorText}>
                  {errors.password}
                </span>
              )}
            </div>
          )}

          {/* Forgot Password Link (only on login) */}
          {isLogin && (
            <div className={styles.forgotPasswordWrapper}>
              <button
                type="button"
                onClick={() => {
                  setViewMode('forgot-password');
                  setError('');
                  setMessage('');
                  setErrors({});
                  setPassword('');
                }}
                className={styles.forgotPasswordButton}
                disabled={loading}
              >
                Lupa password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={styles.submitButton}
          >
            {loading && <Loader2 size={16} className={styles.spinner} />}
            {isLogin && 'Login'}
            {viewMode === 'register' && 'Daftar'}
            {isForgotPassword && 'Kirim Link Reset'}
          </button>
        </form>

        {/* Back Button (for forgot password) */}
        {isForgotPassword && (
          <button
            onClick={() => {
              setViewMode('login');
              setError('');
              setMessage('');
              setErrors({});
              setEmail('');
            }}
            className={styles.backtoLoginButton}
            disabled={loading}
          >
            Kembali ke Login
          </button>
        )}

        {/* Divider (hide on forgot password) */}
        {!isForgotPassword && (
          <div className={styles.divider}>
            <div className={styles.dividerLine} />
            <span className={styles.dividerText}>atau</span>
            <div className={styles.dividerLine} />
          </div>
        )}

        {/* Google Login Button (hide on forgot password) */}
        {!isForgotPassword && (
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className={styles.googleButton}
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.335z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
              />
            </svg>
            {isLogin ? 'Login' : 'Daftar'} dengan Google
          </button>
        )}

        {/* Switch (hide on forgot password) */}
        {!isForgotPassword && (
          <div className={styles.switch}>
            {isLogin ? 'Belum punya akun? ' : 'Sudah punya akun? '}
            <button
              onClick={() => {
                setViewMode(isLogin ? 'register' : 'login');
                setError('');
                setMessage('');
                setErrors({});
                setEmail('');
                setPassword('');
                setFullName('');
              }}
              className={styles.switchButton}
              disabled={loading}
              type="button"
            >
              {isLogin ? 'Daftar' : 'Login'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}