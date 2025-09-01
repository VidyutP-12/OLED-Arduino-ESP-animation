import { supabase, supabaseAdmin, TABLES, VIDEO_STATUS } from '../config/supabase.js';

export class DatabaseService {
  /**
   * Create a new video upload record
   */
  async createVideoUpload(userId, uploadData) {
    const { data, error } = await supabase
      .from(TABLES.VIDEO_UPLOADS)
      .insert({
        user_id: userId,
        original_filename: uploadData.filename,
        file_size: uploadData.size,
        file_path: uploadData.path,
        mime_type: uploadData.mimeType,
        duration: uploadData.duration,
        original_width: uploadData.width,
        original_height: uploadData.height,
        original_fps: uploadData.fps,
        status: VIDEO_STATUS.UPLOADING
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create video upload: ${error.message}`);
    }

    return data;
  }

  /**
   * Update video upload status
   */
  async updateVideoUploadStatus(uploadId, status, errorMessage = null) {
    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { data, error } = await supabase
      .from(TABLES.VIDEO_UPLOADS)
      .update(updateData)
      .eq('id', uploadId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update video upload status: ${error.message}`);
    }

    return data;
  }

  /**
   * Create processing configuration
   */
  async createProcessingConfig(videoUploadId, config) {
    const { data, error } = await supabase
      .from(TABLES.PROCESSING_CONFIGS)
      .insert({
        video_upload_id: videoUploadId,
        display_width: config.displayWidth,
        display_height: config.displayHeight,
        orientation: config.orientation,
        library: config.library,
        target_fps: config.targetFps,
        threshold: config.threshold,
        max_frames: config.maxFrames
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create processing config: ${error.message}`);
    }

    return data;
  }

  /**
   * Create processed video record
   */
  async createProcessedVideo(videoUploadId, processingConfigId, processedData) {
    const { data, error } = await supabase
      .from(TABLES.PROCESSED_VIDEOS)
      .insert({
        video_upload_id: videoUploadId,
        processing_config_id: processingConfigId,
        processed_frames_count: processedData.frameCount,
        final_width: processedData.width,
        final_height: processedData.height,
        final_fps: processedData.fps,
        frame_data_size: processedData.frameDataSize,
        processing_time_ms: processedData.processingTime,
        arduino_code: processedData.arduinoCode,
        preview_gif_path: processedData.previewGifPath
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create processed video: ${error.message}`);
    }

    return data;
  }

  /**
   * Store frame data
   */
  async storeFrameData(processedVideoId, frames) {
    const frameRecords = frames.map((frameData, index) => ({
      processed_video_id: processedVideoId,
      frame_index: index,
      frame_data: frameData,
      frame_size: frameData.length
    }));

    const { data, error } = await supabase
      .from(TABLES.FRAME_DATA)
      .insert(frameRecords);

    if (error) {
      throw new Error(`Failed to store frame data: ${error.message}`);
    }

    return data;
  }

  /**
   * Get processed video with frame data
   */
  async getProcessedVideo(processedVideoId) {
    // Get processed video
    const { data: processedVideo, error: videoError } = await supabase
      .from(TABLES.PROCESSED_VIDEOS)
      .select(`
        *,
        video_uploads!inner(*),
        processing_configs!inner(*)
      `)
      .eq('id', processedVideoId)
      .single();

    if (videoError) {
      throw new Error(`Failed to get processed video: ${videoError.message}`);
    }

    // Get frame data
    const { data: frameData, error: frameError } = await supabase
      .from(TABLES.FRAME_DATA)
      .select('*')
      .eq('processed_video_id', processedVideoId)
      .order('frame_index');

    if (frameError) {
      throw new Error(`Failed to get frame data: ${frameError.message}`);
    }

    return {
      ...processedVideo,
      frames: frameData.map(fd => fd.frame_data)
    };
  }

  /**
   * Get user's video uploads
   */
  async getUserVideoUploads(userId, limit = 20, offset = 0) {
    const { data, error } = await supabase
      .from(TABLES.VIDEO_UPLOADS)
      .select(`
        *,
        processed_videos (
          *,
          processing_configs (*)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get user video uploads: ${error.message}`);
    }

    return data;
  }

  /**
   * Get video upload by ID
   */
  async getVideoUpload(uploadId) {
    const { data, error } = await supabase
      .from(TABLES.VIDEO_UPLOADS)
      .select(`
        *,
        processed_videos (
          *,
          processing_configs (*)
        )
      `)
      .eq('id', uploadId)
      .single();

    if (error) {
      throw new Error(`Failed to get video upload: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete video upload and related data
   */
  async deleteVideoUpload(uploadId) {
    // Delete in order due to foreign key constraints
    const { error: frameError } = await supabase
      .from(TABLES.FRAME_DATA)
      .delete()
      .in('processed_video_id', 
        supabase
          .from(TABLES.PROCESSED_VIDEOS)
          .select('id')
          .eq('video_upload_id', uploadId)
      );

    if (frameError) {
      throw new Error(`Failed to delete frame data: ${frameError.message}`);
    }

    const { error: processedError } = await supabase
      .from(TABLES.PROCESSED_VIDEOS)
      .delete()
      .eq('video_upload_id', uploadId);

    if (processedError) {
      throw new Error(`Failed to delete processed videos: ${processedError.message}`);
    }

    const { error: configError } = await supabase
      .from(TABLES.PROCESSING_CONFIGS)
      .delete()
      .eq('video_upload_id', uploadId);

    if (configError) {
      throw new Error(`Failed to delete processing configs: ${configError.message}`);
    }

    const { error: uploadError } = await supabase
      .from(TABLES.VIDEO_UPLOADS)
      .delete()
      .eq('id', uploadId);

    if (uploadError) {
      throw new Error(`Failed to delete video upload: ${uploadError.message}`);
    }

    return true;
  }

  /**
   * Track usage analytics
   */
  async trackUsage(userId, actionType, metadata = {}, videoUploadId = null) {
    const { error } = await supabase
      .from(TABLES.USAGE_ANALYTICS)
      .insert({
        user_id: userId,
        video_upload_id: videoUploadId,
        action_type: actionType,
        metadata
      });

    if (error) {
      console.warn('Failed to track usage analytics:', error.message);
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId) {
    const { data, error } = await supabase
      .from(TABLES.USERS)
      .select('total_conversions, total_uploads, is_premium, subscription_expires_at')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(`Failed to get user stats: ${error.message}`);
    }

    return data;
  }

  /**
   * Update user stats
   */
  async updateUserStats(userId, updates) {
    const { data, error } = await supabase
      .from(TABLES.USERS)
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user stats: ${error.message}`);
    }

    return data;
  }

  /**
   * Create user session
   */
  async createUserSession(userId, sessionToken, ipAddress, userAgent) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    const { data, error } = await supabase
      .from(TABLES.USER_SESSIONS)
      .insert({
        user_id: userId,
        session_token: sessionToken,
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user session: ${error.message}`);
    }

    return data;
  }

  /**
   * Validate user session
   */
  async validateUserSession(sessionToken) {
    const { data, error } = await supabase
      .from(TABLES.USER_SESSIONS)
      .select('*')
      .eq('session_token', sessionToken)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  /**
   * Invalidate user session
   */
  async invalidateUserSession(sessionToken) {
    const { error } = await supabase
      .from(TABLES.USER_SESSIONS)
      .update({ is_active: false })
      .eq('session_token', sessionToken);

    if (error) {
      throw new Error(`Failed to invalidate session: ${error.message}`);
    }

    return true;
  }
}




