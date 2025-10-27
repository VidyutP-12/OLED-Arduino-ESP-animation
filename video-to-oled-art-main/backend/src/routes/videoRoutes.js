const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const SupabaseService = require('../services/supabaseService');
const VideoProcessor = require('../services/videoProcessor');
const { authenticateToken, checkRateLimit, validateTier, logAnalytics, validateFileUpload } = require('../middleware/auth');

const router = express.Router();
const supabaseService = new SupabaseService();
const videoProcessor = new VideoProcessor();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024, // 100MB
    files: 1
  }
});

// Ensure upload directory exists
const ensureUploadDir = async () => {
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  try {
    await fs.mkdir(uploadDir, { recursive: true });
  } catch (error) {
    console.error('Error creating upload directory:', error);
  }
};

ensureUploadDir();

// Upload video endpoint
router.post('/upload', 
  authenticateToken,
  checkRateLimit('video_upload', 10, 60), // 10 uploads per hour
  upload.single('video'),
  validateFileUpload(),
  logAnalytics('upload', 'video'),
  async (req, res) => {
    try {
      const { originalname, filename, size, mimetype, path: filePath } = req.file;
      
      // Get video metadata
      const metadata = await videoProcessor.getVideoMetadata(filePath);
      
      // Create video upload record
      const uploadData = {
        original_filename: originalname,
        file_size: size,
        file_type: mimetype,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        fps: metadata.fps,
        upload_path: filePath,
        status: 'pending',
        metadata: {
          bitrate: metadata.bitrate,
          size: metadata.size
        }
      };

      const videoUpload = await supabaseService.createVideoUpload(req.user.id, uploadData);

      res.status(201).json({
        success: true,
        data: {
          uploadId: videoUpload.id,
          filename: originalname,
          size: size,
          duration: metadata.duration,
          dimensions: `${metadata.width}x${metadata.height}`,
          fps: metadata.fps
        }
      });
    } catch (error) {
      console.error('Video upload error:', error);
      
      // Cleanup uploaded file on error
      if (req.file && req.file.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up uploaded file:', cleanupError);
        }
      }

      res.status(500).json({
        error: 'Video upload failed',
        code: 'UPLOAD_FAILED',
        message: error.message
      });
    }
  }
);

// Process video endpoint
router.post('/:uploadId/process',
  authenticateToken,
  checkRateLimit('video_process', 20, 60), // 20 processes per hour
  logAnalytics('process', 'video'),
  async (req, res) => {
    try {
      const { uploadId } = req.params;
      const {
        displaySize = '128x64',
        orientation = 'horizontal',
        library = 'adafruit_gfx_ssd1306',
        targetFps = 15,
        threshold = 128,
        maxFrames = 20
      } = req.body;

      // Get video upload record
      const videoUpload = await supabaseService.getVideoUpload(uploadId, req.user.id);
      
      if (!videoUpload) {
        return res.status(404).json({
          error: 'Video upload not found',
          code: 'UPLOAD_NOT_FOUND'
        });
      }

      if (videoUpload.status !== 'pending') {
        return res.status(400).json({
          error: 'Video is already being processed or has been processed',
          code: 'ALREADY_PROCESSED'
        });
      }

      // Update status to processing
      await supabaseService.updateVideoUpload(uploadId, req.user.id, {
        status: 'processing'
      });

      // Process video asynchronously
      processVideoAsync(uploadId, req.user.id, videoUpload.upload_path, {
        displaySize,
        orientation,
        library,
        targetFps,
        threshold,
        maxFrames
      });

      res.status(202).json({
        success: true,
        message: 'Video processing started',
        uploadId: uploadId
      });
    } catch (error) {
      console.error('Video processing error:', error);
      res.status(500).json({
        error: 'Video processing failed',
        code: 'PROCESS_FAILED',
        message: error.message
      });
    }
  }
);

// Get processing status
router.get('/:uploadId/status',
  authenticateToken,
  async (req, res) => {
    try {
      const { uploadId } = req.params;
      
      const videoUpload = await supabaseService.getVideoUpload(uploadId, req.user.id);
      
      if (!videoUpload) {
        return res.status(404).json({
          error: 'Video upload not found',
          code: 'UPLOAD_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: {
          uploadId: videoUpload.id,
          status: videoUpload.status,
          filename: videoUpload.original_filename,
          size: videoUpload.file_size,
          duration: videoUpload.duration,
          dimensions: videoUpload.width && videoUpload.height ? 
            `${videoUpload.width}x${videoUpload.height}` : null,
          fps: videoUpload.fps,
          createdAt: videoUpload.created_at,
          updatedAt: videoUpload.updated_at
        }
      });
    } catch (error) {
      console.error('Status check error:', error);
      res.status(500).json({
        error: 'Status check failed',
        code: 'STATUS_CHECK_FAILED',
        message: error.message
      });
    }
  }
);

// Get processed video
router.get('/processed/:processedId',
  authenticateToken,
  async (req, res) => {
    try {
      const { processedId } = req.params;
      
      const processedVideo = await supabaseService.getProcessedVideo(processedId, req.user.id);
      
      if (!processedVideo) {
        return res.status(404).json({
          error: 'Processed video not found',
          code: 'PROCESSED_VIDEO_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: {
          id: processedVideo.id,
          displaySize: processedVideo.display_size,
          orientation: processedVideo.orientation,
          library: processedVideo.library,
          frameCount: processedVideo.frame_count,
          width: processedVideo.width,
          height: processedVideo.height,
          fps: processedVideo.actual_fps,
          duration: processedVideo.duration,
          codeSize: processedVideo.code_size,
          processingTime: processedVideo.processing_time,
          status: processedVideo.status,
          createdAt: processedVideo.created_at,
          expiresAt: processedVideo.expires_at
        }
      });
    } catch (error) {
      console.error('Get processed video error:', error);
      res.status(500).json({
        error: 'Failed to get processed video',
        code: 'GET_PROCESSED_VIDEO_FAILED',
        message: error.message
      });
    }
  }
);

// Download Arduino code
router.get('/processed/:processedId/download',
  authenticateToken,
  checkRateLimit('download', 50, 60), // 50 downloads per hour
  logAnalytics('download', 'code'),
  async (req, res) => {
    try {
      const { processedId } = req.params;
      
      const processedVideo = await supabaseService.getProcessedVideo(processedId, req.user.id);
      
      if (!processedVideo) {
        return res.status(404).json({
          error: 'Processed video not found',
          code: 'PROCESSED_VIDEO_NOT_FOUND'
        });
      }

      if (processedVideo.status !== 'completed') {
        return res.status(400).json({
          error: 'Video processing not completed',
          code: 'PROCESSING_NOT_COMPLETE'
        });
      }

      // Set headers for file download
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="video_to_oled_${processedId}.ino"`);
      res.setHeader('Content-Length', processedVideo.code_size);

      // Send the Arduino code
      res.send(processedVideo.arduino_code);
    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({
        error: 'Download failed',
        code: 'DOWNLOAD_FAILED',
        message: error.message
      });
    }
  }
);

// Get user's video uploads
router.get('/uploads',
  authenticateToken,
  async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      
      const uploads = await supabaseService.getUserVideoUploads(
        req.user.id,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({
        success: true,
        data: uploads.map(upload => ({
          id: upload.id,
          filename: upload.original_filename,
          size: upload.file_size,
          duration: upload.duration,
          dimensions: upload.width && upload.height ? 
            `${upload.width}x${upload.height}` : null,
          fps: upload.fps,
          status: upload.status,
          createdAt: upload.created_at,
          expiresAt: upload.expires_at
        }))
      });
    } catch (error) {
      console.error('Get uploads error:', error);
      res.status(500).json({
        error: 'Failed to get uploads',
        code: 'GET_UPLOADS_FAILED',
        message: error.message
      });
    }
  }
);

// Get user's processed videos
router.get('/processed',
  authenticateToken,
  async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      
      const processedVideos = await supabaseService.getUserProcessedVideos(
        req.user.id,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({
        success: true,
        data: processedVideos.map(video => ({
          id: video.id,
          uploadId: video.upload_id,
          filename: video.video_uploads?.original_filename,
          displaySize: video.display_size,
          orientation: video.orientation,
          library: video.library,
          frameCount: video.frame_count,
          width: video.width,
          height: video.height,
          fps: video.actual_fps,
          duration: video.duration,
          codeSize: video.code_size,
          processingTime: video.processing_time,
          status: video.status,
          createdAt: video.created_at,
          expiresAt: video.expires_at
        }))
      });
    } catch (error) {
      console.error('Get processed videos error:', error);
      res.status(500).json({
        error: 'Failed to get processed videos',
        code: 'GET_PROCESSED_VIDEOS_FAILED',
        message: error.message
      });
    }
  }
);

// Delete video upload
router.delete('/:uploadId',
  authenticateToken,
  logAnalytics('delete', 'video'),
  async (req, res) => {
    try {
      const { uploadId } = req.params;
      
      const videoUpload = await supabaseService.getVideoUpload(uploadId, req.user.id);
      
      if (!videoUpload) {
        return res.status(404).json({
          error: 'Video upload not found',
          code: 'UPLOAD_NOT_FOUND'
        });
      }

      // Delete the file from disk
      try {
        await fs.unlink(videoUpload.upload_path);
      } catch (fileError) {
        console.error('Error deleting file:', fileError);
      }

      // Delete from database (this will cascade to processed videos and frame data)
      await supabaseService.client
        .from('video_uploads')
        .delete()
        .eq('id', uploadId)
        .eq('user_id', req.user.id);

      res.json({
        success: true,
        message: 'Video upload deleted successfully'
      });
    } catch (error) {
      console.error('Delete upload error:', error);
      res.status(500).json({
        error: 'Failed to delete upload',
        code: 'DELETE_UPLOAD_FAILED',
        message: error.message
      });
    }
  }
);

// Async function to process video
async function processVideoAsync(uploadId, userId, filePath, options) {
  try {
    console.log(`Starting video processing for upload ${uploadId}`);
    
    // Process the video
    const result = await videoProcessor.extractFrames(filePath, options);
    
    // Generate Arduino code
    const arduinoCode = videoProcessor.generateArduinoCode(
      result.framesPacked,
      result.width,
      result.height,
      result.fps,
      options.library
    );

    // Create processed video record
    const processedVideoData = {
      upload_id: uploadId,
      display_size: options.displaySize,
      orientation: options.orientation,
      library: options.library,
      target_fps: options.targetFps,
      actual_fps: result.fps,
      frame_count: result.frameCount,
      width: result.width,
      height: result.height,
      duration: result.duration,
      arduino_code: arduinoCode,
      code_size: Buffer.byteLength(arduinoCode, 'utf8'),
      processing_time: Date.now() - new Date().getTime(), // This should be calculated properly
      status: 'completed',
      metadata: {
        originalFps: result.metadata.fps,
        originalWidth: result.metadata.width,
        originalHeight: result.metadata.height,
        bitrate: result.metadata.bitrate
      }
    };

    const processedVideo = await supabaseService.createProcessedVideo(userId, processedVideoData);

    // Save frame data
    for (let i = 0; i < result.framesPacked.length; i++) {
      await supabaseService.saveFrameData(processedVideo.id, i, result.framesPacked[i]);
    }

    // Update video upload status
    await supabaseService.updateVideoUpload(uploadId, userId, {
      status: 'completed'
    });

    // Update user statistics
    await supabaseService.updateUserProfile(userId, {
      total_conversions: supabaseService.client.raw('total_conversions + 1'),
      total_processing_time: supabaseService.client.raw(`total_processing_time + ${processedVideoData.processing_time}`)
    });

    console.log(`Video processing completed for upload ${uploadId}, processed video ${processedVideo.id}`);
    
  } catch (error) {
    console.error(`Video processing failed for upload ${uploadId}:`, error);
    
    // Update video upload status to failed
    try {
      await supabaseService.updateVideoUpload(uploadId, userId, {
        status: 'failed',
        metadata: { error: error.message }
      });
    } catch (updateError) {
      console.error('Error updating upload status to failed:', updateError);
    }
  }
}

module.exports = router;