const SupabaseService = require('../services/supabaseService');

const supabaseService = new SupabaseService();

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        code: 'MISSING_TOKEN'
      });
    }

    // Verify the JWT token with Supabase
    const user = await supabaseService.verifyJWT(token);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ 
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

// Middleware to check rate limits
const checkRateLimit = (endpoint, maxRequests = 100, windowMinutes = 60) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const isAllowed = await supabaseService.checkRateLimit(
        req.user.id,
        endpoint,
        maxRequests,
        windowMinutes
      );

      if (!isAllowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: windowMinutes * 60
        });
      }

      next();
    } catch (error) {
      console.error('Rate limit check error:', error);
      // Allow request to proceed if rate limit check fails
      next();
    }
  };
};

// Middleware to validate user tier permissions
const validateTier = (requiredTier) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const userProfile = await supabaseService.getUserProfile(req.user.id);
      
      if (!userProfile) {
        return res.status(404).json({ 
          error: 'User profile not found',
          code: 'USER_NOT_FOUND'
        });
      }

      const tierHierarchy = {
        'free': 0,
        'premium': 1,
        'pro': 2
      };

      const userTierLevel = tierHierarchy[userProfile.tier] || 0;
      const requiredTierLevel = tierHierarchy[requiredTier] || 0;

      if (userTierLevel < requiredTierLevel) {
        return res.status(403).json({
          error: `This feature requires ${requiredTier} tier or higher`,
          code: 'INSUFFICIENT_TIER',
          currentTier: userProfile.tier,
          requiredTier: requiredTier
        });
      }

      req.userProfile = userProfile;
      next();
    } catch (error) {
      console.error('Tier validation error:', error);
      return res.status(500).json({ 
        error: 'Tier validation failed',
        code: 'TIER_VALIDATION_FAILED'
      });
    }
  };
};

// Middleware to log analytics
const logAnalytics = (action, resourceType = null) => {
  return async (req, res, next) => {
    try {
      // Log the analytics after the request is processed
      res.on('finish', async () => {
        try {
          if (req.user) {
            await supabaseService.logAnalytics(
              req.user.id,
              action,
              resourceType,
              req.params.id || req.body.id,
              {
                method: req.method,
                endpoint: req.path,
                statusCode: res.statusCode,
                userAgent: req.get('User-Agent'),
                ip: req.ip
              },
              req.ip,
              req.get('User-Agent')
            );
          }
        } catch (error) {
          console.error('Analytics logging error:', error);
        }
      });

      next();
    } catch (error) {
      console.error('Analytics middleware error:', error);
      next();
    }
  };
};

// Middleware to validate file upload
const validateFileUpload = (options = {}) => {
  const {
    maxSize = 100 * 1024 * 1024, // 100MB
    allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/webm'],
    maxDuration = 30 // seconds
  } = options;

  return (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          code: 'NO_FILE'
        });
      }

      // Check file size
      if (req.file.size > maxSize) {
        return res.status(400).json({
          error: `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`,
          code: 'FILE_TOO_LARGE',
          maxSize: maxSize
        });
      }

      // Check file type
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
          code: 'INVALID_FILE_TYPE',
          allowedTypes: allowedTypes
        });
      }

      next();
    } catch (error) {
      console.error('File validation error:', error);
      return res.status(400).json({
        error: 'File validation failed',
        code: 'FILE_VALIDATION_FAILED'
      });
    }
  };
};

// Middleware to handle errors
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error response
  let status = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation error';
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    status = 401;
    message = 'Unauthorized';
    code = 'UNAUTHORIZED';
  } else if (err.name === 'ForbiddenError') {
    status = 403;
    message = 'Forbidden';
    code = 'FORBIDDEN';
  } else if (err.name === 'NotFoundError') {
    status = 404;
    message = 'Not found';
    code = 'NOT_FOUND';
  } else if (err.name === 'RateLimitError') {
    status = 429;
    message = 'Rate limit exceeded';
    code = 'RATE_LIMIT_EXCEEDED';
  }

  res.status(status).json({
    error: message,
    code: code,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Middleware to handle 404s
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.path,
    method: req.method
  });
};

module.exports = {
  authenticateToken,
  checkRateLimit,
  validateTier,
  logAnalytics,
  validateFileUpload,
  errorHandler,
  notFoundHandler
};