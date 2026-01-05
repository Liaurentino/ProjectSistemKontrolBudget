import { supabase } from './supabase';

const CLIENT_ID = import.meta.env.VITE_ACCURATE_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_ACCURATE_REDIRECT_URI;

// 1. Generate Authorization URL
export const getAuthorizationUrl = () => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: 'read write',
  });

  return `https://account.accurate.id/oauth/authorize?${params.toString()}`;
};

// 2. Exchange code untuk access token
export const exchangeCodeForToken = async (code: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('accurate-oauth', {
      body: { action: 'exchangeCode', code },
    });

    if (error) throw error;

    // Simpan access token ke localStorage atau database
    localStorage.setItem('accurate_access_token', data.access_token);
    localStorage.setItem('accurate_refresh_token', data.refresh_token);
    localStorage.setItem('accurate_expires_in', String(Date.now() + data.expires_in * 1000));

    return { data, error: null };
  } catch (error) {
    console.error('Error exchanging code:', error);
    return { data: null, error };
  }
};

// 3. Get stored access token
export const getAccessToken = () => {
  return localStorage.getItem('accurate_access_token');
};

// 4. Check if token expired
export const isTokenExpired = () => {
  const expiresIn = localStorage.getItem('accurate_expires_in');
  return !expiresIn || Date.now() > parseInt(expiresIn);
};

// 5. Call Accurate API dengan access token
export const callAccurateAPI = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token. Please authorize first.');
  }

  if (isTokenExpired()) {
    throw new Error('Token expired. Please authorize again.');
  }

  const response = await fetch(`https://account.accurate.id${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return response.json();
};