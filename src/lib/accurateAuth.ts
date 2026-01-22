import { supabase } from "./supabase";// Sesuaikan path Anda

// Environment variables
const ACCURATE_CLIENT_ID = import.meta.env.VITE_ACCURATE_CLIENT_ID;
const ACCURATE_REDIRECT_URI = import.meta.env.VITE_ACCURATE_REDIRECT_URI;
const SUPABASE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_FUNCTION_URL;

interface AccurateTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  user: {
    name: string;
    email: string;
  };
}

/**
 * Service untuk integrasi Accurate Online
 * BUKAN untuk login/register user!
 * Hanya untuk mendapatkan access token untuk sync data
 */
class AccurateAuthService {
  
  /**
   * Step 1: Redirect user ke halaman otorisasi Accurate
   * User harus sudah login di aplikasi kita terlebih dahulu!
   */
  initiateAccurateConnection(scopes: string[] = ['item_view', 'item_save']) {
    // Check if user is logged in to our app
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert('Please login first before connecting to Accurate!');
        window.location.href = '/auth'; // Redirect ke halaman auth
        return;
      }

      // Build authorization URL
      const params = new URLSearchParams({
        client_id: ACCURATE_CLIENT_ID,
        response_type: 'code', // Authorization Code flow
        redirect_uri: ACCURATE_REDIRECT_URI,
        scope: scopes.join(' '),
      });

      const authUrl = `https://account.accurate.id/oauth/authorize?${params.toString()}`;
      
      console.log('🔗 Redirecting to Accurate authorization:', authUrl);
      window.location.href = authUrl;
    };

    checkAuth();
  }

  /**
   * Step 2: Handle callback dari Accurate
   * Dipanggil dari halaman callback setelah user approve di Accurate
   */
  async handleAccurateCallback(code: string): Promise<AccurateTokenResponse> {
    try {
      console.log('📥 Received authorization code from Accurate');
      console.log('🔄 Exchanging code for access token...');

      // Call edge function untuk exchange code
      const response = await fetch(`${SUPABASE_FUNCTION_URL}/accurate-oauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }), // ← CORRECT: Kirim code di body
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to exchange authorization code');
      }

      const tokenData: AccurateTokenResponse = await response.json();
      console.log('✅ Successfully received access token from Accurate');

      // Save tokens to database (linked to current user)
      await this.saveAccurateTokens(tokenData);

      return tokenData;
    } catch (error) {
      console.error('❌ Error handling Accurate callback:', error);
      throw error;
    }
  }

  /**
   * Save Accurate tokens to database
   * Linked to current logged-in user
   */
  private async saveAccurateTokens(tokenData: AccurateTokenResponse) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not logged in');
      }

      // Calculate expiry date (15 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 15);

      // Upsert to accurate_connections table
      const { error } = await supabase
        .from('accurate_connections')
        .upsert({
          user_id: user.id,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          accurate_user_name: tokenData.user.name,
          accurate_user_email: tokenData.user.email,
          expires_at: expiresAt.toISOString(),
          scope: tokenData.scope,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      console.log('✅ Accurate tokens saved to database');
    } catch (error) {
      console.error('❌ Error saving Accurate tokens:', error);
      throw error;
    }
  }

  /**
   * Get current user's Accurate connection status
   */
  async getConnectionStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { connected: false, needsRefresh: false };
      }

      const { data, error } = await supabase
        .from('accurate_connections')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        return { connected: false, needsRefresh: false };
      }

      // ✅ IMPROVED: Check if token is expired or will expire soon (within 1 day)
      const expiresAt = new Date(data.expires_at);
      const now = new Date();
      const oneDayFromNow = new Date();
      oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

      // Token needs refresh if:
      // 1. Already expired (expiresAt <= now), OR
      // 2. Will expire within 1 day (expiresAt <= oneDayFromNow)
      const needsRefresh = expiresAt <= now || expiresAt <= oneDayFromNow;

      return {
        connected: true,
        needsRefresh,
        accurateUser: {
          name: data.accurate_user_name,
          email: data.accurate_user_email,
        },
        expiresAt: data.expires_at,
      };
    } catch (error) {
      console.error('❌ Error getting connection status:', error);
      return { connected: false, needsRefresh: false };
    }
  }

  /**
   * Refresh Accurate access token
   */
  async refreshAccessToken() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not logged in');
      }

      // Get current refresh token
      const { data: connection, error: fetchError } = await supabase
        .from('accurate_connections')
        .select('refresh_token')
        .eq('user_id', user.id)
        .single();

      if (fetchError || !connection) {
        throw new Error('No Accurate connection found');
      }

      console.log('🔄 Refreshing Accurate access token...');

      // Call edge function untuk refresh token
      const response = await fetch(`${SUPABASE_FUNCTION_URL}/accurate-oauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          refreshToken: connection.refresh_token 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to refresh token');
      }

      const tokenData: AccurateTokenResponse = await response.json();
      console.log('✅ Access token refreshed successfully');

      // Update tokens in database
      await this.saveAccurateTokens(tokenData);

      return tokenData;
    } catch (error) {
      console.error('❌ Error refreshing access token:', error);
      throw error;
    }
  }

  /**
   * Disconnect Accurate account
   */
  async disconnectAccurate() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not logged in');
      }

      const { error } = await supabase
        .from('accurate_connections')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      console.log('✅ Accurate account disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting Accurate:', error);
      throw error;
    }
  }

  /**
   * Get valid access token (auto-refresh if needed)
   */
  async getValidAccessToken(): Promise<string> {
    const status = await this.getConnectionStatus();

    if (!status.connected) {
      throw new Error('Accurate account not connected');
    }

    if (status.needsRefresh) {
      console.log('🔄 Token needs refresh, refreshing...');
      const tokenData = await this.refreshAccessToken();
      return tokenData.access_token;
    }

    // Get current token from database
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not logged in');

    const { data, error } = await supabase
      .from('accurate_connections')
      .select('access_token')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      throw new Error('Failed to get access token');
    }

    return data.access_token;
  }
}

// Export singleton instance
export const accurateAuth = new AccurateAuthService();