import { DatabaseService } from '../services/databaseService.js';

const dbService = new DatabaseService();

/**
 * Middleware to authenticate requests using Supabase JWT
 */
export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Validate the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
};

/**
 * Middleware to authenticate requests using session token
 */
export const authenticateSession = async (req, res, next) => {
  try {
    const sessionToken = req.headers['x-session-token'] || req.cookies?.sessionToken;
    
    if (!sessionToken) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing session token'
      });
    }

    const session = await dbService.validateUserSession(sessionToken);
    
    if (!session) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired session'
      });
    }

    // Add user info to request object
    req.user = { id: session.user_id };
    req.session = session;
    next();
  } catch (error) {
    console.error('Session authentication error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Session authentication failed'
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no auth provided
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Don't fail the request, just continue without user
    next();
  }
};

/**
 * Rate limiting middleware
 */
export const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    if (requests.has(key)) {
      const userRequests = requests.get(key).filter(timestamp => timestamp > windowStart);
      requests.set(key, userRequests);
    } else {
      requests.set(key, []);
    }
    
    const userRequests = requests.get(key);
    
    if (userRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.'
      });
    }
    
    userRequests.push(now);
    next();
  };
};

/**
 * Premium user check middleware
 */
export const requirePremium = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const userStats = await dbService.getUserStats(req.user.id);
    
    if (!userStats.is_premium) {
      return res.status(403).json({
        error: 'Premium Required',
        message: 'This feature requires a premium subscription'
      });
    }

    // Check if subscription is expired
    if (userStats.subscription_expires_at && new Date(userStats.subscription_expires_at) < new Date()) {
      return res.status(403).json({
        error: 'Subscription Expired',
        message: 'Your premium subscription has expired'
      });
    }

    next();
  } catch (error) {
    console.error('Premium check error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify premium status'
    });
  }
};




