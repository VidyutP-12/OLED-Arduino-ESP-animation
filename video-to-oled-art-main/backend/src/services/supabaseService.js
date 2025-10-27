const { createClient } = require('@supabase/supabase-js');

class SupabaseService {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!this.supabaseUrl || !this.supabaseAnonKey || !this.supabaseServiceKey) {
      throw new Error('Missing required Supabase environment variables');
    }

    // Client for user operations (uses anon key)
    this.client = createClient(this.supabaseUrl, this.supabaseAnonKey);
    
    // Admin client for service operations (uses service role key)
    this.adminClient = createClient(this.supabaseUrl, this.supabaseServiceKey);
  }

  // User Management
  async getUserProfile(userId) {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  async updateUserProfile(userId, updates) {
    try {
      const { data, error } = await this.client
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  async getUserStats(userId) {
    try {
      const { data, error } = await this.adminClient
        .rpc('get_user_stats', { user_uuid: userId });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }

  // Video Upload Management
  async createVideoUpload(userId, uploadData) {
    try {
      const { data, error } = await this.client
        .from('video_uploads')
        .insert({
          user_id: userId,
          ...uploadData
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating video upload:', error);
      throw error;
    }
  }

  async getVideoUpload(uploadId, userId) {
    try {
      const { data, error } = await this.client
        .from('video_uploads')
        .select('*')
        .eq('id', uploadId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting video upload:', error);
      throw error;
    }
  }

  async updateVideoUpload(uploadId, userId, updates) {
    try {
      const { data, error } = await this.client
        .from('video_uploads')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', uploadId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating video upload:', error);
      throw error;
    }
  }

  async getUserVideoUploads(userId, limit = 50, offset = 0) {
    try {
      const { data, error } = await this.client
        .from('video_uploads')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user video uploads:', error);
      throw error;
    }
  }

  // Processing Configuration Management
  async createProcessingConfig(userId, configData) {
    try {
      const { data, error } = await this.client
        .from('processing_configs')
        .insert({
          user_id: userId,
          ...configData
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating processing config:', error);
      throw error;
    }
  }

  async getUserProcessingConfigs(userId) {
    try {
      const { data, error } = await this.client
        .from('processing_configs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user processing configs:', error);
      throw error;
    }
  }

  async getDefaultProcessingConfigs() {
    try {
      const { data, error } = await this.client
        .from('processing_configs')
        .select('*')
        .eq('is_default', true)
        .is('user_id', null);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting default processing configs:', error);
      throw error;
    }
  }

  // Processed Videos Management
  async createProcessedVideo(userId, videoData) {
    try {
      const { data, error } = await this.client
        .from('processed_videos')
        .insert({
          user_id: userId,
          ...videoData
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating processed video:', error);
      throw error;
    }
  }

  async getProcessedVideo(processedId, userId) {
    try {
      const { data, error } = await this.client
        .from('processed_videos')
        .select('*')
        .eq('id', processedId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting processed video:', error);
      throw error;
    }
  }

  async getUserProcessedVideos(userId, limit = 50, offset = 0) {
    try {
      const { data, error } = await this.client
        .from('processed_videos')
        .select(`
          *,
          video_uploads!inner(original_filename, file_size, duration)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user processed videos:', error);
      throw error;
    }
  }

  // Frame Data Management
  async saveFrameData(processedVideoId, frameIndex, frameData) {
    try {
      const { data, error } = await this.client
        .from('frame_data')
        .upsert({
          processed_video_id: processedVideoId,
          frame_index: frameIndex,
          frame_data: frameData
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving frame data:', error);
      throw error;
    }
  }

  async getFrameData(processedVideoId, frameIndex) {
    try {
      const { data, error } = await this.client
        .from('frame_data')
        .select('frame_data')
        .eq('processed_video_id', processedVideoId)
        .eq('frame_index', frameIndex)
        .single();

      if (error) throw error;
      return data?.frame_data;
    } catch (error) {
      console.error('Error getting frame data:', error);
      throw error;
    }
  }

  async getAllFrameData(processedVideoId) {
    try {
      const { data, error } = await this.client
        .from('frame_data')
        .select('frame_index, frame_data')
        .eq('processed_video_id', processedVideoId)
        .order('frame_index');

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting all frame data:', error);
      throw error;
    }
  }

  // Analytics Management
  async logAnalytics(userId, action, resourceType = null, resourceId = null, metadata = {}, ipAddress = null, userAgent = null) {
    try {
      const { data, error } = await this.client
        .from('usage_analytics')
        .insert({
          user_id: userId,
          action,
          resource_type: resourceType,
          resource_id: resourceId,
          metadata,
          ip_address: ipAddress,
          user_agent: userAgent
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error logging analytics:', error);
      throw error;
    }
  }

  async getUserAnalytics(userId, limit = 50, offset = 0) {
    try {
      const { data, error } = await this.client
        .from('usage_analytics')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user analytics:', error);
      throw error;
    }
  }

  // Rate Limiting
  async checkRateLimit(userId, endpoint, maxRequests = 100, windowMinutes = 60) {
    try {
      const { data, error } = await this.adminClient
        .rpc('check_rate_limit', {
          user_uuid: userId,
          endpoint_name: endpoint,
          max_requests: maxRequests,
          window_minutes: windowMinutes
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error checking rate limit:', error);
      throw error;
    }
  }

  // Session Management
  async createUserSession(userId, sessionToken, expiresAt, ipAddress = null, userAgent = null) {
    try {
      const { data, error } = await this.client
        .from('user_sessions')
        .insert({
          user_id: userId,
          session_token: sessionToken,
          expires_at: expiresAt,
          ip_address: ipAddress,
          user_agent: userAgent
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating user session:', error);
      throw error;
    }
  }

  async validateUserSession(sessionToken) {
    try {
      const { data, error } = await this.client
        .from('user_sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error validating user session:', error);
      return null;
    }
  }

  async updateUserSession(sessionToken, updates) {
    try {
      const { data, error } = await this.client
        .from('user_sessions')
        .update({
          ...updates,
          last_used: new Date().toISOString()
        })
        .eq('session_token', sessionToken)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating user session:', error);
      throw error;
    }
  }

  async deleteUserSession(sessionToken) {
    try {
      const { data, error } = await this.client
        .from('user_sessions')
        .update({ is_active: false })
        .eq('session_token', sessionToken)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error deleting user session:', error);
      throw error;
    }
  }

  // Cleanup Operations
  async cleanupExpiredData() {
    try {
      const { data, error } = await this.adminClient
        .rpc('cleanup_expired_data');

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error cleaning up expired data:', error);
      throw error;
    }
  }

  // Authentication Helpers
  async verifyJWT(token) {
    try {
      const { data: { user }, error } = await this.client.auth.getUser(token);
      if (error) throw error;
      return user;
    } catch (error) {
      console.error('Error verifying JWT:', error);
      return null;
    }
  }

  async refreshToken(refreshToken) {
    try {
      const { data, error } = await this.client.auth.refreshSession({
        refresh_token: refreshToken
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }
}

module.exports = SupabaseService;

