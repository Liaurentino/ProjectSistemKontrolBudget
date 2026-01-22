// lib/accurateValidate.ts

import { supabase } from './supabase';

export interface AccurateValidationResult {
  isValid: boolean;
  error?: string;
  accurateUserInfo?: {
    name: string;
    email: string;
    sub: string;
  };
  details?: any;
}

/**
 * Validate token format before sending to API
 */
function validateTokenFormat(token: string): { valid: boolean; error?: string } {
  // 1. Check if empty
  if (!token || token.trim().length === 0) {
    return {
      valid: false,
      error: 'API Token harus diisi',
    };
  }

  const trimmedToken = token.trim();

  // 2. Check minimum length (Accurate tokens are ~400+ chars)
  if (trimmedToken.length < 100) {
    return {
      valid: false,
      error: 'API Token tidak valid. Pastikan token lengkap dan benar',
    };
  }

  // 3. Check if starts with "aat." (Accurate Access Token prefix)
  if (!trimmedToken.startsWith('aat.')) {
    return {
      valid: false,
      error: 'Format token salah. Token Accurate harus diawali dengan "aat."',
    };
  }

  // 4. Check for valid characters (base64 + dots + slashes)
  // Accurate tokens menggunakan: a-z, A-Z, 0-9, +, /, =, .
  if (!/^[a-zA-Z0-9+/=.]+$/.test(trimmedToken)) {
    return {
      valid: false,
      error: 'Token mengandung karakter tidak valid. Pastikan tidak ada spasi atau karakter khusus lainnya',
    };
  }

  // 5. Check if has proper JWT-like structure (should have dots separating sections)
  const parts = trimmedToken.split('.');
  if (parts.length < 3) {
    return {
      valid: false,
      error: 'Format token tidak lengkap. Pastikan Anda menyalin seluruh token dari Accurate',
    };
  }

  return { valid: true };
}

/**
 * Validate Accurate API Token ownership
 * Calls Supabase Edge Function to check if token belongs to current user
 */
export async function validateAccurateTokenOwnership(
  apiToken: string
): Promise<AccurateValidationResult> {
  try {
    // ✅ STEP 1: Validate format BEFORE calling API
    const formatCheck = validateTokenFormat(apiToken);
    if (!formatCheck.valid) {
      return {
        isValid: false,
        error: formatCheck.error,
      };
    }

    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return {
        isValid: false,
        error: 'Anda belum login. Silakan login terlebih dahulu',
      };
    }

    // ✅ STEP 2: Call Edge Function untuk validasi ownership
    console.log('[AccurateValidation] Validating token ownership...');
    
    const { data, error } = await supabase.functions.invoke('accurate-validate-ownership', {
      body: { apiToken: apiToken.trim() }
    });

    // ✅ LOG DETAIL
    console.log('[AccurateValidation] Raw Response:', { data, error });

    // ✅ STEP 3: Handle transport-level errors (network, timeout, etc.)
    if (error) {
      console.error('[AccurateValidation] Transport Error:', error);
      
      return {
        isValid: false,
        error: 'Gagal terhubung ke server. Periksa koneksi internet Anda dan coba lagi',
      };
    }

    // ✅ STEP 4: Handle missing data
    if (!data) {
      return {
        isValid: false,
        error: 'Tidak ada response dari server. Silakan coba lagi',
      };
    }

    // ✅ STEP 5: Check isValid flag in response
    // Sekarang edge function SELALU return status 200, jadi data pasti terisi
    if (data.isValid === false) {
      // Token tidak valid / email tidak cocok
      console.log('[AccurateValidation] ❌ Validation failed:', data.error);
      
      return {
        isValid: false,
        error: data.error || 'Token tidak valid',
        details: data.details,
      };
    }

    // ✅ STEP 6: SUCCESS
    if (data.isValid === true) {
      console.log('[AccurateValidation] ✓ Token ownership validated');
      return {
        isValid: true,
        accurateUserInfo: data.accurateUserInfo,
      };
    }

    // ✅ FALLBACK: Unexpected response format
    console.warn('[AccurateValidation] Unexpected response format:', data);
    return {
      isValid: false,
      error: 'Format response tidak valid. Silakan coba lagi',
    };

  } catch (err) {
    console.error('[AccurateValidation] Validation Error:', err);
    
    const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga';
    
    return {
      isValid: false,
      error: `Gagal validasi: ${errorMessage}`,
    };
  }
}

/**
 * Quick format validation (untuk real-time feedback di form)
 * Tidak memanggil API, hanya cek format
 */
export function quickValidateTokenFormat(token: string): string | null {
  const result = validateTokenFormat(token);
  return result.valid ? null : (result.error ?? null);
}