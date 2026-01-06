import { supabase } from './supabase';

// ============================================
// CONSTANTS & CONFIG
// ============================================

const EDGE_FUNCTION_URL = 'accurate-validate';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accurate_access_token',
  REFRESH_TOKEN: 'accurate_refresh_token',
  EXPIRES_AT: 'accurate_expires_at',
} as const;

// ============================================
// TYPES
// ============================================

export interface AccurateAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  timestamp?: string;
}

export interface AccurateDatabase {
  id: string;
  name: string;
  code: string;
  company_name? :  string;
  database_id?: string;
  db_code?: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
}

export interface AccurateValidationResult {
  isValid: boolean;
  message:   string;
  databases? :  AccurateDatabase[];
  primaryDatabase?: AccurateDatabase;
  error?: string;
  raw?: any;
}

// ============================================
// TOKEN MANAGEMENT
// ============================================

/**
 * Get stored access token
 */
export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  } catch (error) {
    console.error('Error reading access token:', error);
    return null;
  }
}

/**
 * Save tokens to localStorage
 */
export function saveTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    localStorage.setItem(
      STORAGE_KEYS. EXPIRES_AT,
      String(Date.now() + expiresIn * 1000)
    );
  } catch (error) {
    console.error('Error saving tokens:', error);
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(): boolean {
  try {
    const expiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
    if (!expiresAt) return true;

    const expiryTime = Number(expiresAt);
    if (isNaN(expiryTime)) return true;

    return Date.now() > expiryTime;
  } catch (error) {
    console.error('Error checking token expiry:', error);
    return true;
  }
}

/**
 * Clear all tokens
 */
export function clearAccurateTokens(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS. ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
  } catch (error) {
    console.error('Error clearing tokens:', error);
  }
}

// ============================================
// API CALLER (Via Edge Function)
// ============================================

/**
 * Call Accurate API via Supabase Edge Function (accurate-validate)
 * Edge Function handle timestamp, signature, dan CORS
 */
export async function callAccurateAPI<T = any>(
  apiToken: string,
  secretKey: string,
  timeout: number = 30000
): Promise<AccurateAPIResponse<T>> {
  try {
    // Validasi input
    if (!apiToken || apiToken.trim().length < 10) {
      return {
        success: false,
        error: 'API Token terlalu pendek atau kosong',
        status: 400,
      };
    }

    if (!secretKey) {
      return {
        success: false,
        error: 'Secret Key tidak dikonfigurasi',
        status:  500,
      };
    }

    console.log('[Middleware] Calling Edge Function:  accurate-validate');

    // Create abort controller untuk timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Call Edge Function via Supabase
      const { data, error } = await supabase. functions. invoke(
        EDGE_FUNCTION_URL,
        {
          body: {
            apiToken:  apiToken. trim(),
            secretKey: secretKey.trim(),
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (error) {
        console.error('[Middleware] Edge Function Error:', error);

        return {
          success: false,
          error: error. message || 'Edge Function error',
          status: 500,
        };
      }

      // Check response dari Accurate API
      if (data?. error) {
        console.error('[Middleware] Accurate API Error:', data.error);

        return {
          success:  false,
          error: data. error,
          status: data. status || 400,
          raw: data,
        };
      }

      console.log('[Middleware] Edge Function Success');

      return {
        success: true,
        data:  data as T,
        status: 200,
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return {
          success: false,
          error: `Request timeout (${timeout}ms)`,
          status: 408,
        };
      }

      throw fetchError;
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ?  error.message : 'Unknown error';
    console.error('[Middleware] API Call Error:', error);

    return {
      success: false,
      error: errorMessage,
      status: 500,
    };
  }
}

// ============================================
// VALIDATION METHODS
// ============================================

/**
 * Normalize database object dari berbagai format response
 */
function normalizeDatabase(db: any): AccurateDatabase {
  return {
    id: db. id || db.database_id || db. dbId || '',
    name: db.name || db.company_name || db.companyName || '',
    code:  db.code || db.db_code || db.dbCode || '',
    company_name: db.company_name || db.name || '',
    database_id:  db.database_id || db. id || '',
    db_code:  db.db_code || db. code || '',
    description: db. description || '',
    email: db.email || '',
    phone: db.phone || '',
    address: db.address || '',
    city: db.city || '',
    province: db.province || '',
    country: db.country || '',
  };
}

/**
 * Parse response dari Accurate API
 * Handle berbagai format response
 */
function parseAccurateResponse(response: any): any[] {
  // Try berbagai format yang mungkin
  if (Array.isArray(response)) {
    return response;
  }

  if (response?. databases && Array.isArray(response.databases)) {
    return response.databases;
  }

  if (response?.data && Array.isArray(response.data)) {
    return response.data;
  }

  if (response?. d && Array.isArray(response. d)) {
    return response. d;
  }

  return [];
}

/**
 * Validate API Token dengan memanggil Edge Function
 * Edge Function akan handle timestamp, signature, dan call Accurate API
 */
export async function validateAccurateApiToken(
  apiToken: string,
  secretKey: string
): Promise<AccurateValidationResult> {
  try {
    // Validasi format token
    if (!apiToken || apiToken.trim().length < 10) {
      return {
        isValid: false,
        message: 'API Token terlalu pendek atau kosong',
      };
    }

    console.log('[Middleware] Validating token via Edge Function.. .');

    // Call Edge Function
    const result = await callAccurateAPI(apiToken, secretKey);

    // Check jika request ke edge function gagal
    if (! result.success) {
      let message = result.error || 'Gagal validasi token';

      if (result.status === 401) {
        message =
          'API Token tidak valid atau sudah kadaluarsa (401 Unauthorized)';
      } else if (result.status === 403) {
        message =
          'Akses ditolak - Token tidak memiliki permission yang cukup (403 Forbidden)';
      } else if (result.status === 408) {
        message = 'Request timeout - Coba lagi';
      }

      return {
        isValid: false,
        message,
        error: result.error,
        raw: result. raw,
      };
    }

    // Parse response dari Accurate
    const rawDatabases = parseAccurateResponse(result.data);

    if (! Array.isArray(rawDatabases) || rawDatabases.length === 0) {
      return {
        isValid: false,
        message: 
          'API Token valid tetapi tidak ada database/usaha yang ditemukan',
        raw: result.data,
      };
    }

    // Normalize databases
    const databases = rawDatabases.map(normalizeDatabase);
    const primaryDatabase = databases[0];

    console.log('[Middleware] Token validated.  Databases:', databases. length);

    return {
      isValid: true,
      message: `✓ API Token valid.  Ditemukan ${databases.length} database. `,
      databases,
      primaryDatabase,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error. message : 'Error tidak diketahui';
    console. error('[Middleware] Validation error:', error);

    return {
      isValid: false,
      message:  `Gagal validasi:  ${errorMsg}`,
      error: errorMsg,
    };
  }
}

/**
 * Get database list dari Accurate API
 */
export async function getAccurateDatabaseList(
  apiToken: string,
  secretKey: string
): Promise<AccurateAPIResponse<AccurateDatabase[]>> {
  try {
    const result = await callAccurateAPI(apiToken, secretKey);

    if (!result.success) {
      return {
        success:  false,
        error: result. error,
        status: result. status,
      };
    }

    // Parse databases
    const rawDatabases = parseAccurateResponse(result.data);

    if (!Array.isArray(rawDatabases)) {
      return {
        success: false,
        error: 'Invalid response format',
        status: 500,
      };
    }

    const databases = rawDatabases.map(normalizeDatabase);

    return {
      success: true,
      data: databases,
      status: result.status,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[Middleware] Get database list error:', error);

    return {
      success: false,
      error: errorMsg,
      status: 500,
    };
  }
}