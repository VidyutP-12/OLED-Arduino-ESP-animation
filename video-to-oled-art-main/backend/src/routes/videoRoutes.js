import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { VideoProcessor } from '../services/videoProcessor.js';
import { DatabaseService } from '../services/databaseService.js';
import { authenticateUser, rateLimit, requirePremium } from '../middleware/auth.js';
import { LIMITS, DISPLAY_SIZES } from '../config/supabase.js';

const router = express.Router();
const videoProcessor = new VideoProcessor();
const dbService = new DatabaseService();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: LIMITS.MAX_FILE_SIZE,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, AVI, MOV, MKV, and WebM files are allowed.'), false);
    }
  }
});

/**
 * Upload video file
 * POST /api/videos/upload
 */
router.post('/upload', 
  authenticateUser, 
  rateLimit(10, 60 * 1000), // 10 uploads per minute
  upload.single('video'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'No video file provided'
        });
      }

      const filePath = req.file.path;
      const fileSize = req.file.size;
      const mimeType = req.file.mimetype;
      const originalName = req.file.originalname;

      // Get video metadata
      const metadata = await videoProcessor.getVideoMetadata(filePath);

      // Create video upload record
      const uploadData = {
        filename: originalName,
        size: fileSize,
        path: filePath,
        mimeType,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        fps: metadata.fps
      };

      const videoUpload = await dbService.createVideoUpload(req.user.id, uploadData);

      // Track usage
      await dbService.trackUsage(req.user.id, 'upload', {
        fileSize,
        duration: metadata.duration,
        originalName
      }, videoUpload.id);

      res.status(201).json({
        message: 'Video uploaded successfully',
        videoUpload: {
          id: videoUpload.id,
          filename: videoUpload.original_filename,
          size: videoUpload.file_size,
          duration: videoUpload.duration,
          width: videoUpload.original_width,
          height: videoUpload.original_height,
          fps: videoUpload.original_fps,
          status: videoUpload.status
        }
      });

    } catch (error) {
      console.error('Upload error:', error);
      
      // Clean up uploaded file if it exists
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.warn('Failed to cleanup uploaded file:', cleanupError.message);
        }
      }

      res.status(500).json({
        error: 'Upload Failed',
        message: error.message
      });
    }
  }
);

/**
 * Process video with configuration
 * POST /api/videos/:uploadId/process
 */
router.post('/:uploadId/process',
  authenticateUser,
  rateLimit(5, 60 * 1000), // 5 processing requests per minute
  async (req, res) => {
    try {
      const { uploadId } = req.params;
      const {
        displaySize = '128x64',
        orientation = 'horizontal',
        library = 'adafruit_gfx_ssd1306',
        targetFps = LIMITS.TARGET_FPS,
        threshold = 128,
        maxFrames = LIMITS.MAX_FRAMES
      } = req.body;

      // Validate display size
      if (!DISPLAY_SIZES[displaySize]) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid display size'
        });
      }

      // Get video upload
      const videoUpload = await dbService.getVideoUpload(uploadId);
      
      if (!videoUpload) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Video upload not found'
        });
      }

      // Check ownership
      if (videoUpload.user_id !== req.user.id) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied'
        });
      }

      // Update status to processing
      await dbService.updateVideoUploadStatus(uploadId, 'processing');

      // Create processing configuration
      const config = {
        displayWidth: DISPLAY_SIZES[displaySize].width,
        displayHeight: DISPLAY_SIZES[displaySize].height,
        orientation,
        library,
        targetFps,
        threshold,
        maxFrames,
        duration: videoUpload.duration
      };

      const processingConfig = await dbService.createProcessingConfig(uploadId, config);

      // Process video asynchronously
      processVideoAsync(uploadId, processingConfig.id, videoUpload.file_path, config);

      res.json({
        message: 'Video processing started',
        uploadId,
        configId: processingConfig.id,
        status: 'processing'
      });

    } catch (error) {
      console.error('Processing error:', error);
      res.status(500).json({
        error: 'Processing Failed',
        message: error.message
      });
    }
  }
);

/**
 * Get processing status
 * GET /api/videos/:uploadId/status
 */
router.get('/:uploadId/status',
  authenticateUser,
  async (req, res) => {
    try {
      const { uploadId } = req.params;
      
      const videoUpload = await dbService.getVideoUpload(uploadId);
      
      if (!videoUpload) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Video upload not found'
        });
      }

      // Check ownership
      if (videoUpload.user_id !== req.user.id) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied'
        });
      }

      res.json({
        uploadId,
        status: videoUpload.status,
        errorMessage: videoUpload.error_message,
        processedVideos: videoUpload.processed_videos || []
      });

    } catch (error) {
      console.error('Status check error:', error);
      res.status(500).json({
        error: 'Status Check Failed',
        message: error.message
      });
    }
  }
);

/**
 * Get processed video with Arduino code
 * GET /api/videos/processed/:processedId
 */
router.get('/processed/:processedId',
  authenticateUser,
  async (req, res) => {
    try {
      const { processedId } = req.params;
      
      const processedVideo = await dbService.getProcessedVideo(processedId);
      
      if (!processedVideo) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Processed video not found'
        });
      }

      // Check ownership
      if (processedVideo.video_uploads.user_id !== req.user.id) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied'
        });
      }

      // Track usage
      await dbService.trackUsage(req.user.id, 'download', {
        processedId,
        frameCount: processedVideo.processed_frames_count
      }, processedVideo.video_upload_id);

      res.json({
        processedVideo: {
          id: processedVideo.id,
          frameCount: processedVideo.processed_frames_count,
          width: processedVideo.final_width,
          height: processedVideo.final_height,
          fps: processedVideo.final_fps,
          processingTime: processedVideo.processing_time_ms,
          arduinoCode: processedVideo.arduino_code,
          previewGifPath: processedVideo.preview_gif_path,
          config: processedVideo.processing_configs
        }
      });

    } catch (error) {
      console.error('Get processed video error:', error);
      res.status(500).json({
        error: 'Failed to Get Processed Video',
        message: error.message
      });
    }
  }
);

/**
 * Download Arduino code as .ino file
 * GET /api/videos/processed/:processedId/download
 */
router.get('/processed/:processedId/download',
  authenticateUser,
  async (req, res) => {
    try {
      const { processedId } = req.params;
      
      const processedVideo = await dbService.getProcessedVideo(processedId);
      
      if (!processedVideo) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Processed video not found'
        });
      }

      // Check ownership
      if (processedVideo.video_uploads.user_id !== req.user.id) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied'
        });
      }

      // Track usage
      await dbService.trackUsage(req.user.id, 'download', {
        processedId,
        frameCount: processedVideo.processed_frames_count
      }, processedVideo.video_upload_id);

      // Set headers for file download
      const filename = `video_to_oled_${processedId}.ino`;
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      res.send(processedVideo.arduino_code);

    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({
        error: 'Download Failed',
        message: error.message
      });
    }
  }
);

/**
 * Get user's video uploads
 * GET /api/videos
 */
router.get('/',
  authenticateUser,
  async (req, res) => {
    try {
      const { limit = 20, offset = 0 } = req.query;
      
      const uploads = await dbService.getUserVideoUploads(
        req.user.id,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({
        uploads,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: uploads.length === parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Get uploads error:', error);
      res.status(500).json({
        error: 'Failed to Get Uploads',
        message: error.message
      });
    }
  }
);

/**
 * Delete video upload
 * DELETE /api/videos/:uploadId
 */
router.delete('/:uploadId',
  authenticateUser,
  async (req, res) => {
    try {
      const { uploadId } = req.params;
      
      const videoUpload = await dbService.getVideoUpload(uploadId);
      
      if (!videoUpload) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Video upload not found'
        });
      }

      // Check ownership
      if (videoUpload.user_id !== req.user.id) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied'
        });
      }

      // Delete from database
      await dbService.deleteVideoUpload(uploadId);

      // Delete file from filesystem
      try {
        await fs.unlink(videoUpload.file_path);
      } catch (fileError) {
        console.warn('Failed to delete video file:', fileError.message);
      }

      res.json({
        message: 'Video upload deleted successfully'
      });

    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({
        error: 'Delete Failed',
        message: error.message
      });
    }
  }
);

/**
 * Async function to process video
 */
async function processVideoAsync(uploadId, configId, videoPath, config) {
  const tempDir = path.join(process.env.TEMP_PATH || './temp', uuidv4());
  
  try {
    console.log(`Starting video processing for upload ${uploadId}`);
    
    // Extract frames
    const processingStart = Date.now();
    const result = await videoProcessor.extractFrames(videoPath, tempDir, config);
    const processingTime = Date.now() - processingStart;

    // Generate Arduino code
    const arduinoCode = videoProcessor.generateArduinoCode(result.frames, {
      width: result.width,
      height: result.height,
      fps: result.fps,
      library: config.library
    });

    // Calculate total frame data size
    const frameDataSize = result.frames.reduce((total, frame) => total + frame.length, 0);

    // Create processed video record
    const processedData = {
      frameCount: result.frameCount,
      width: result.width,
      height: result.height,
      fps: result.fps,
      frameDataSize,
      processingTime,
      arduinoCode,
      previewGifPath: null // TODO: Generate preview GIF
    };

    const processedVideo = await dbService.createProcessedVideo(uploadId, configId, processedData);

    // Store frame data
    await dbService.storeFrameData(processedVideo.id, result.frames);

    // Update upload status to completed
    await dbService.updateVideoUploadStatus(uploadId, 'completed');

    console.log(`Video processing completed for upload ${uploadId}`);

  } catch (error) {
    console.error(`Video processing failed for upload ${uploadId}:`, error);
    
    // Update upload status to failed
    await dbService.updateVideoUploadStatus(uploadId, 'failed', error.message);
  } finally {
    // Clean up temporary files
    await videoProcessor.cleanupTempFiles(tempDir);
  }
}

export default router;




