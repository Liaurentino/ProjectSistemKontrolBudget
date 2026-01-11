import {
  validateEntitasToken,
  getEntitasList,
  type AccurateValidationResult,
} from '../lib/accurate';

const HMAC_SECRET_KEY = import.meta. env.VITE_ACCURATE_HMAC_SECRET || '';

/**
 * Wrapper untuk validasi entitas token
 */
export const validateAccurateApiToken = async (
  apiToken: string
): Promise<AccurateValidationResult> => {
  return validateEntitasToken(apiToken, HMAC_SECRET_KEY);
};

/**
 * Wrapper untuk get database list
 */
export const getAccurateDatabaseList = async (apiToken: string) => {
  return getEntitasList(apiToken, HMAC_SECRET_KEY);
};