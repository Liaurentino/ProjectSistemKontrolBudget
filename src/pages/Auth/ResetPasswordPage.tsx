import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import styles from './AuthPage.module.css'; // Reuse AuthPage styles

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  // Check if user has valid recovery session
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // If no session or not a recovery session, redirect to login
      if (!session) {
        console.error('[ResetPassword] No valid session found');
        setError('Link reset password tidak valid atau sudah kadaluarsa. Silakan request ulang.');
      }
    };

    checkSession();
  }, []);

  // Validation
  const validatePassword = (password: string) => {
    if (!password) return 'Password baru harus diisi';
    if (password.length < 6) return 'Password minimal 6 karakter';
    return '';
  };

  const validateConfirmPassword = (confirm: string, newPass: string) => {
    if (!confirm) return 'Konfirmasi password harus diisi';
    if (confirm !== newPass) return 'Password tidak cocok';
    return '';
  };

  const handleBlur = (field: 'newPassword' | 'confirmPassword') => {
    const newErrors = { ...errors };
    
    if (field === 'newPassword') {
      newErrors.newPassword = validatePassword(newPassword);
    } else if (field === 'confirmPassword') {
      newErrors.confirmPassword = validateConfirmPassword(confirmPassword, newPassword);
    }
    
    setErrors(newErrors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate all fields
    const newErrors = {
      newPassword: validatePassword(newPassword),
      confirmPassword: validateConfirmPassword(confirmPassword, newPassword),
    };

    setErrors(newErrors);

    if (Object.values(newErrors).some(err => err !== '')) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);

    } catch (err: any) {
      console.error('[ResetPassword] Error:', err);
      setError(err.message || 'Gagal mengubah password');
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.successState}>
            <CheckCircle size={64} className={styles.successIcon} />
            <h2 className={styles.title}>Password Berhasil Diubah!</h2>
            <p className={styles.subtitle}>
              Anda akan dialihkan ke halaman login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Reset Password</h2>
          <p className={styles.subtitle}>
            Masukkan password baru Anda
          </p>
        </div>

        {/* Alert */}
        {error && (
          <div className={styles.errorAlert}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* New Password */}
          <div className={styles.formGroupPassword}>
            <label className={styles.label}>
              Password Baru
            </label>
            <div className={styles.passwordWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errors.newPassword) {
                    setErrors({ ...errors, newPassword: '' });
                  }
                }}
                onBlur={() => handleBlur('newPassword')}
                className={`${styles.passwordInput} ${errors.newPassword ? styles.passwordInputError : ''}`}
                disabled={loading}
                placeholder="Minimal 6 karakter"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={styles.togglePasswordButton}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.newPassword && (
              <span className={styles.errorText}>
                {errors.newPassword}
              </span>
            )}
          </div>

          {/* Confirm Password */}
          <div className={styles.formGroupPassword}>
            <label className={styles.label}>
              Konfirmasi Password Baru
            </label>
            <div className={styles.passwordWrapper}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) {
                    setErrors({ ...errors, confirmPassword: '' });
                  }
                }}
                onBlur={() => handleBlur('confirmPassword')}
                className={`${styles.passwordInput} ${errors.confirmPassword ? styles.passwordInputError : ''}`}
                disabled={loading}
                placeholder="Ketik ulang password baru"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className={styles.togglePasswordButton}
                disabled={loading}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className={styles.errorText}>
                {errors.confirmPassword}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className={styles.submitButton}
          >
            {loading && <Loader2 size={16} className={styles.spinner} />}
            Ubah Password
          </button>
        </form>

        <div className={styles.switch}>
          Kembali ke{' '}
          <a href="/" className={styles.switchButton}>
            Login
          </a>
        </div>
      </div>
    </div>
  );
}