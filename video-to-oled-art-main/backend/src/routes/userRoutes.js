import express from 'express';
import { DatabaseService } from '../services/databaseService.js';
import { authenticateUser, rateLimit } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';

const router = express.Router();
const dbService = new DatabaseService();

/**
 * Get user profile
 * GET /api/user/profile
 */
router.get('/profile',
  authenticateUser,
  async (req, res) => {
    try {
      const userStats = await dbService.getUserStats(req.user.id);
      
      res.json({
        user: {
          id: req.user.id,
          email: req.user.email,
          totalConversions: userStats.total_conversions,
          totalUploads: userStats.total_uploads,
          isPremium: userStats.is_premium,
          subscriptionExpiresAt: userStats.subscription_expires_at
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        error: 'Failed to Get Profile',
        message: error.message
      });
    }
  }
);

/**
 * Update user profile
 * PUT /api/user/profile
 */
router.put('/profile',
  authenticateUser,
  rateLimit(10, 60 * 1000), // 10 updates per minute
  async (req, res) => {
    try {
      const { email } = req.body;
      
      if (email && email !== req.user.email) {
        // Update email in Supabase auth
        const { error } = await supabase.auth.updateUser({ email });
        
        if (error) {
          return res.status(400).json({
            error: 'Update Failed',
            message: error.message
          });
        }
      }

      res.json({
        message: 'Profile updated successfully'
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        error: 'Update Failed',
        message: error.message
      });
    }
  }
);

/**
 * Get user statistics
 * GET /api/user/stats
 */
router.get('/stats',
  authenticateUser,
  async (req, res) => {
    try {
      const stats = await dbService.getUserStats(req.user.id);
      
      res.json({
        stats: {
          totalConversions: stats.total_conversions,
          totalUploads: stats.total_uploads,
          isPremium: stats.is_premium,
          subscriptionExpiresAt: stats.subscription_expires_at
        }
      });

    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        error: 'Failed to Get Stats',
        message: error.message
      });
    }
  }
);

/**
 * Get user usage analytics
 * GET /api/user/analytics
 */
router.get('/analytics',
  authenticateUser,
  async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      
      const { data, error } = await supabase
        .from('usage_analytics')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (error) {
        throw new Error(error.message);
      }

      res.json({
        analytics: data,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: data.length === parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({
        error: 'Failed to Get Analytics',
        message: error.message
      });
    }
  }
);

/**
 * Delete user account
 * DELETE /api/user/account
 */
router.delete('/account',
  authenticateUser,
  rateLimit(1, 24 * 60 * 60 * 1000), // 1 deletion per day
  async (req, res) => {
    try {
      // Delete user from Supabase auth
      const { error } = await supabase.auth.admin.deleteUser(req.user.id);
      
      if (error) {
        return res.status(400).json({
          error: 'Delete Failed',
          message: error.message
        });
      }

      res.json({
        message: 'Account deleted successfully'
      });

    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({
        error: 'Delete Failed',
        message: error.message
      });
    }
  }
);

/**
 * Create user session
 * POST /api/user/session
 */
router.post('/session',
  authenticateUser,
  async (req, res) => {
    try {
      const sessionToken = require('crypto').randomBytes(32).toString('hex');
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const session = await dbService.createUserSession(
        req.user.id,
        sessionToken,
        ipAddress,
        userAgent
      );

      res.json({
        sessionToken,
        expiresAt: session.expires_at
      });

    } catch (error) {
      console.error('Create session error:', error);
      res.status(500).json({
        error: 'Session Creation Failed',
        message: error.message
      });
    }
  }
);

/**
 * Invalidate user session
 * DELETE /api/user/session
 */
router.delete('/session',
  async (req, res) => {
    try {
      const sessionToken = req.headers['x-session-token'] || req.cookies?.sessionToken;
      
      if (!sessionToken) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Session token required'
        });
      }

      await dbService.invalidateUserSession(sessionToken);

      res.json({
        message: 'Session invalidated successfully'
      });

    } catch (error) {
      console.error('Invalidate session error:', error);
      res.status(500).json({
        error: 'Session Invalidation Failed',
        message: error.message
      });
    }
  }
);

export default router;




