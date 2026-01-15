// lib/accurateValidation.ts

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
 * Validate Accurate API Token ownership
 * Calls Supabase Edge Function to check if token belongs to current user
 */
export async function validateAccurateTokenOwnership(
  apiToken: string
): Promise<AccurateValidationResult> {
  try {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return {
        isValid: false,
        error: 'User not authenticated',
      };
    }

    const { data, error } = await supabase.functions.invoke('accurate-validate-entity', {
        body: { apiToken },
        headers: {
            Authorization: `Bearer ${session.access_token}`,  // ← Ini yang kurang!
        },
    });

    if (error) {
      console.error('Edge Function Error:', error);
      return {
        isValid: false,
        error: error.message || 'Gagal validasi token',
      };
    }

    // Handle error response from Edge Function
    if (data.error) {
      return {
        isValid: false,
        error: data.error,
        details: data.details,
      };
    }

    // Success
    return {
      isValid: true,
      accurateUserInfo: data.accurateUserInfo,
    };
  } catch (err) {
    console.error('Validation Error:', err);
    return {
      isValid: false,
      error: err instanceof Error ? err.message : 'Terjadi kesalahan',
    };
  }
}