import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import styles from './AuthPage.module.css';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
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

  // Validasi email
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return 'Email harus diisi';
    if (!emailRegex.test(email)) return 'Format email tidak valid';
    return '';
  };

  // Validasi password
  const validatePassword = (password: string) => {
    if (!password) return 'Password harus diisi';
    if (password.length < 6) return 'Password minimal 6 karakter';
    return '';
  };

  // Validasi nama lengkap
  const validateFullName = (name: string) => {
    if (!name.trim()) return 'Nama lengkap harus diisi';
    if (name.trim().length < 3) return 'Nama minimal 3 karakter';
    return '';
  };

  // Handle blur untuk validasi real-time
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

  // Google OAuth
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Gagal login dengan Google');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    // Validasi semua field
    const newErrors: any = {};
    newErrors.email = validateEmail(email);
    newErrors.password = validatePassword(password);
    
    if (!isLogin) {
      newErrors.fullName = validateFullName(fullName);
    }
    
    setErrors(newErrors);
    
    // Cek apakah ada error
    if (Object.values(newErrors).some(err => err !== '')) {
      return;
    }
    
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage('Login berhasil');
        setTimeout(() => (window.location.href = '/dashboard'), 800);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;

        setMessage(
          data.user && !data.session
            ? 'Cek email untuk konfirmasi'
            : 'Registrasi berhasil'
        );
        if (data.session) {
          setTimeout(() => (window.location.href = '/dashboard'), 800);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            {isLogin ? 'Login' : 'Registrasi'}
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
        <form onSubmit={handleSubmit}>
          {!isLogin && (
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
            />
            {errors.email && (
              <span className={styles.errorText}>
                {errors.email}
              </span>
            )}
          </div>

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
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={styles.togglePasswordButton}
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

          <button
            type="submit"
            disabled={loading}
            className={styles.submitButton}
          >
            {loading && <Loader2 size={16} className={styles.spinner} />}
            {isLogin ? 'Login' : 'Daftar'}
          </button>
        </form>

        {/* Divider */}
        <div className={styles.divider}>
          <div className={styles.dividerLine} />
          <span className={styles.dividerText}>
            atau
          </span>
          <div className={styles.dividerLine} />
        </div>

        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className={styles.googleButton}
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

        {/* Switch */}
        <div className={styles.switch}>
          {isLogin ? 'Belum punya akun? ' : 'Sudah punya akun? '}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setMessage('');
              setErrors({});
            }}
            className={styles.switchButton}
          >
            {isLogin ? 'Daftar' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  );
}