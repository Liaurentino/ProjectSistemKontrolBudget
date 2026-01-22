const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface AccurateDatabase {
  id: string;
  name: string;
  code: string;
  company_name?: string;
  database_id?: string;
  db_code?: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  alias?: string;
  trial?: boolean;
  expired?: boolean;
  admin?: boolean;
  dataAccessType?: string;
}

export interface AccurateValidationResult {
  isValid: boolean;
  message: string;
  databases?: AccurateDatabase[];
  primaryDatabase?: AccurateDatabase;
  error?: string;
  raw?: any;
}

interface AccurateAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  raw?: any;
}

/**
 * Call Accurate API via Supabase Edge Function
 */
async function callAccurateAPI(
  apiToken: string,
  secretKey: string
): Promise<AccurateAPIResponse> {
  try {
    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/accurate-validate`;

    console.log('[Middleware] Calling Edge Function:', edgeFunctionUrl);

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        apiToken,
        secretKey,
      }),
    });

    const data = await response.json();

    console.log('[Middleware] Edge Function Response:', data);

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
        status: response.status,
        raw: data,
      };
    }

    return {
      success: true,
      data,
      status: response.status,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Middleware] API call error:', error);

    return {
      success: false,
      error: errorMsg,
      status: 500,
    };
  }
}

/**
 * Parse response dari Accurate API
 * Response format: { s: true, d: [...] }
 */
function parseAccurateResponse(data: any): any[] {
  console.log('[Middleware] Parsing Accurate response:', data);

  // Check if response has the correct format
  if (!data || typeof data !== 'object') {
    console.warn('[Middleware] Invalid response format - not an object');
    return [];
  }

  // Accurate API format: { s: boolean, d: array }
  if (data.s === true && Array.isArray(data.d)) {
    console.log('[Middleware] Valid Accurate format, databases:', data.d.length);
    return data.d;
  }

  // Fallback: if data is already an array
  if (Array.isArray(data)) {
    console.log('[Middleware] Data is array, databases:', data.length);
    return data;
  }

  console.warn('[Middleware] Unknown response format');
  return [];
}

/**
 * Normalize database object dari Accurate API
 * Mapping field dari response Accurate ke format standar
 */
function normalizeDatabase(db: any): AccurateDatabase {
  return {
    // Primary fields (mapped from Accurate response)
    id: String(db.id || ''),
    name: db.alias || db.name || '',  // ← alias adalah nama entitas!
    code: db.code || db.db_code || '',
    
    // Additional fields
    company_name: db.alias || db.company_name || '',
    database_id: String(db.id || ''),
    db_code: db.code || '',
    description: db.description || '',
    email: db.email || '',
    phone: db.phone || '',
    address: db.address || '',
    city: db.city || '',
    province: db.province || '',
    country: db.country || '',
    
    // Accurate-specific fields
    alias: db.alias || '',
    trial: db.trial || false,
    expired: db.expired || false,
    admin: db.admin || false,
    dataAccessType: db.dataAccessType || '',
  };
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

    if (!secretKey || secretKey.trim().length < 10) {
      return {
        isValid: false,
        message: 'Secret Key terlalu pendek atau kosong',
      };
    }

    console.log('[Middleware] Validating token via Edge Function...');

    // Call Edge Function
    const result = await callAccurateAPI(apiToken, secretKey);

    // Check jika request ke edge function gagal
    if (!result.success) {
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
        raw: result.raw,
      };
    }

    // Parse response dari Accurate
    const rawDatabases = parseAccurateResponse(result.data);

    if (!Array.isArray(rawDatabases) || rawDatabases.length === 0) {
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

    console.log('[Middleware] Token validated. Databases:', databases.length);
    console.log('[Middleware] Primary database:', primaryDatabase);

    return {
      isValid: true,
      message: `✓ API Token valid. Ditemukan ${databases.length} database.`,
      databases,
      primaryDatabase,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : 'Error tidak diketahui';
    console.error('[Middleware] Validation error:', error);

    return {
      isValid: false,
      message: `Gagal validasi: ${errorMsg}`,
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
        success: false,
        error: result.error,
        status: result.status,
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

/**
 * Placeholder function untuk kompatibilitas
 * Returns null karena tidak menggunakan access token system
 */
export async function getAccessToken(): Promise<string | null> {
  return null;
}

/**
 * Placeholder function untuk kompatibilitas
 * Tidak melakukan apa-apa karena menggunakan API Token system
 */
export async function saveTokens(
  _accessToken: string,
  _refreshToken: string
): Promise<void> {
  // Intentionally empty - using API Token instead
}