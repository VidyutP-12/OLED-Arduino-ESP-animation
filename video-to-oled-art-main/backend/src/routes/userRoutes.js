const express = require('express');
const SupabaseService = require('../services/supabaseService');
const { authenticateToken, checkRateLimit, logAnalytics } = require('../middleware/auth');

const router = express.Router();
const supabaseService = new SupabaseService();

// Get user profile
router.get('/profile',
  authenticateToken,
  async (req, res) => {
    try {
      const profile = await supabaseService.getUserProfile(req.user.id);
      
      if (!profile) {
        return res.status(404).json({
          error: 'User profile not found',
          code: 'PROFILE_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: {
          id: profile.id,
          email: profile.email,
          displayName: profile.display_name,
          avatarUrl: profile.avatar_url,
          tier: profile.tier,
          createdAt: profile.created_at,
          lastActive: profile.last_active,
          totalUploads: profile.total_uploads,
          totalConversions: profile.total_conversions,
          totalProcessingTime: profile.total_processing_time,
          storageUsed: profile.storage_used,
          preferences: profile.preferences,
          isActive: profile.is_active
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        error: 'Failed to get profile',
        code: 'GET_PROFILE_FAILED',
        message: error.message
      });
    }
  }
);

// Update user profile
router.put('/profile',
  authenticateToken,
  checkRateLimit('profile_update', 10, 60), // 10 updates per hour
  logAnalytics('update_profile'),
  async (req, res) => {
    try {
      const {
        displayName,
        avatarUrl,
        preferences
      } = req.body;

      const updates = {};
      
      if (displayName !== undefined) {
        updates.display_name = displayName;
      }
      
      if (avatarUrl !== undefined) {
        updates.avatar_url = avatarUrl;
      }
      
      if (preferences !== undefined) {
        updates.preferences = preferences;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          error: 'No valid fields to update',
          code: 'NO_UPDATES'
        });
      }

      const updatedProfile = await supabaseService.updateUserProfile(req.user.id, updates);

      res.json({
        success: true,
        data: {
          id: updatedProfile.id,
          email: updatedProfile.email,
          displayName: updatedProfile.display_name,
          avatarUrl: updatedProfile.avatar_url,
          tier: updatedProfile.tier,
          createdAt: updatedProfile.created_at,
          lastActive: updatedProfile.last_active,
          totalUploads: updatedProfile.total_uploads,
          totalConversions: updatedProfile.total_conversions,
          totalProcessingTime: updatedProfile.total_processing_time,
          storageUsed: updatedProfile.storage_used,
          preferences: updatedProfile.preferences,
          isActive: updatedProfile.is_active
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        error: 'Failed to update profile',
        code: 'UPDATE_PROFILE_FAILED',
        message: error.message
      });
    }
  }
);

// Get user statistics
router.get('/stats',
  authenticateToken,
  async (req, res) => {
    try {
      const stats = await supabaseService.getUserStats(req.user.id);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        error: 'Failed to get statistics',
        code: 'GET_STATS_FAILED',
        message: error.message
      });
    }
  }
);

// Get user analytics
router.get('/analytics',
  authenticateToken,
  async (req, res) => {
    try {
      const { limit = 50, offset = 0, action, resourceType } = req.query;
      
      let query = supabaseService.client
        .from('usage_analytics')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (action) {
        query = query.eq('action', action);
      }
      
      if (resourceType) {
        query = query.eq('resource_type', resourceType);
      }

      const { data: analytics, error } = await query;

      if (error) throw error;

      res.json({
        success: true,
        data: analytics.map(entry => ({
          id: entry.id,
          action: entry.action,
          resourceType: entry.resource_type,
          resourceId: entry.resource_id,
          metadata: entry.metadata,
          ipAddress: entry.ip_address,
          userAgent: entry.user_agent,
          createdAt: entry.created_at
        }))
      });
    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({
        error: 'Failed to get analytics',
        code: 'GET_ANALYTICS_FAILED',
        message: error.message
      });
    }
  }
);

// Get processing configurations
router.get('/configs',
  authenticateToken,
  async (req, res) => {
    try {
      const configs = await supabaseService.getUserProcessingConfigs(req.user.id);
      
      res.json({
        success: true,
        data: configs.map(config => ({
          id: config.id,
          name: config.name,
          displaySize: config.display_size,
          orientation: config.orientation,
          library: config.library,
          targetFps: config.target_fps,
          maxFrames: config.max_frames,
          threshold: config.threshold,
          isDefault: config.is_default,
          createdAt: config.created_at,
          updatedAt: config.updated_at
        }))
      });
    } catch (error) {
      console.error('Get configs error:', error);
      res.status(500).json({
        error: 'Failed to get configurations',
        code: 'GET_CONFIGS_FAILED',
        message: error.message
      });
    }
  }
);

// Create processing configuration
router.post('/configs',
  authenticateToken,
  checkRateLimit('config_create', 20, 60), // 20 configs per hour
  logAnalytics('create_config'),
  async (req, res) => {
    try {
      const {
        name,
        displaySize,
        orientation,
        library,
        targetFps = 15,
        maxFrames = 20,
        threshold = 128
      } = req.body;

      if (!displaySize || !orientation || !library) {
        return res.status(400).json({
          error: 'Missing required fields: displaySize, orientation, library',
          code: 'MISSING_FIELDS'
        });
      }

      const configData = {
        name: name || `${displaySize} ${orientation} ${library}`,
        display_size: displaySize,
        orientation: orientation,
        library: library,
        target_fps: targetFps,
        max_frames: maxFrames,
        threshold: threshold
      };

      const config = await supabaseService.createProcessingConfig(req.user.id, configData);

      res.status(201).json({
        success: true,
        data: {
          id: config.id,
          name: config.name,
          displaySize: config.display_size,
          orientation: config.orientation,
          library: config.library,
          targetFps: config.target_fps,
          maxFrames: config.max_frames,
          threshold: config.threshold,
          isDefault: config.is_default,
          createdAt: config.created_at,
          updatedAt: config.updated_at
        }
      });
    } catch (error) {
      console.error('Create config error:', error);
      res.status(500).json({
        error: 'Failed to create configuration',
        code: 'CREATE_CONFIG_FAILED',
        message: error.message
      });
    }
  }
);

// Get default processing configurations
router.get('/configs/defaults',
  async (req, res) => {
    try {
      const configs = await supabaseService.getDefaultProcessingConfigs();
      
      res.json({
        success: true,
        data: configs.map(config => ({
          id: config.id,
          name: config.name,
          displaySize: config.display_size,
          orientation: config.orientation,
          library: config.library,
          targetFps: config.target_fps,
          maxFrames: config.max_frames,
          threshold: config.threshold,
          isDefault: config.is_default
        }))
      });
    } catch (error) {
      console.error('Get default configs error:', error);
      res.status(500).json({
        error: 'Failed to get default configurations',
        code: 'GET_DEFAULT_CONFIGS_FAILED',
        message: error.message
      });
    }
  }
);

// Update user tier (admin only - this would typically be handled by a separate admin service)
router.put('/tier',
  authenticateToken,
  checkRateLimit('tier_update', 5, 60), // 5 updates per hour
  logAnalytics('update_tier'),
  async (req, res) => {
    try {
      const { tier } = req.body;

      if (!['free', 'premium', 'pro'].includes(tier)) {
        return res.status(400).json({
          error: 'Invalid tier. Must be one of: free, premium, pro',
          code: 'INVALID_TIER'
        });
      }

      // In a real application, this would require admin privileges
      // For now, we'll allow users to downgrade their own tier
      const currentProfile = await supabaseService.getUserProfile(req.user.id);
      const tierHierarchy = { 'free': 0, 'premium': 1, 'pro': 2 };
      
      if (tierHierarchy[tier] > tierHierarchy[currentProfile.tier]) {
        return res.status(403).json({
          error: 'Cannot upgrade tier through this endpoint',
          code: 'TIER_UPGRADE_FORBIDDEN'
        });
      }

      const updatedProfile = await supabaseService.updateUserProfile(req.user.id, {
        tier: tier
      });

      res.json({
        success: true,
        data: {
          id: updatedProfile.id,
          tier: updatedProfile.tier,
          updatedAt: updatedProfile.updated_at
        }
      });
    } catch (error) {
      console.error('Update tier error:', error);
      res.status(500).json({
        error: 'Failed to update tier',
        code: 'UPDATE_TIER_FAILED',
        message: error.message
      });
    }
  }
);

// Delete user account
router.delete('/account',
  authenticateToken,
  checkRateLimit('account_delete', 1, 60), // 1 deletion per hour
  logAnalytics('delete_account'),
  async (req, res) => {
    try {
      // This would typically require additional confirmation
      // and would cascade delete all user data
      
      // For now, we'll just deactivate the account
      const updatedProfile = await supabaseService.updateUserProfile(req.user.id, {
        is_active: false
      });

      res.json({
        success: true,
        message: 'Account deactivated successfully'
      });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({
        error: 'Failed to delete account',
        code: 'DELETE_ACCOUNT_FAILED',
        message: error.message
      });
    }
  }
);

module.exports = router;