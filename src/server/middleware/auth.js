const jwt = require('jsonwebtoken');
const winston = require('winston');

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Access Token Required',
      message: 'Authentication token is required to access this resource'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      winston.warn('JWT verification failed', { error: err.message, token: token.substring(0, 20) + '...' });
      return res.status(403).json({
        error: 'Invalid Token',
        message: 'The provided authentication token is invalid or expired'
      });
    }

    req.user = user;
    next();
  });
};

// Role-based authorization middleware
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication Required',
        message: 'User authentication is required'
      });
    }

    if (!req.user.roles || !req.user.roles.some(role => allowedRoles.includes(role))) {
      winston.warn('Unauthorized access attempt', {
        userId: req.user.id,
        userRoles: req.user.roles,
        requiredRoles: allowedRoles,
        path: req.path,
        method: req.method
      });

      return res.status(403).json({
        error: 'Insufficient Permissions',
        message: 'You do not have the required permissions to access this resource'
      });
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user;
      }
    });
  }

  next();
};

// API key authentication for service-to-service calls
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key Required',
      message: 'API key is required for service authentication'
    });
  }

  // In production, validate against a database or secure store
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];

  if (!validApiKeys.includes(apiKey)) {
    winston.warn('Invalid API key attempt', {
      apiKey: apiKey.substring(0, 8) + '...',
      ip: req.ip,
      path: req.path
    });

    return res.status(403).json({
      error: 'Invalid API Key',
      message: 'The provided API key is not valid'
    });
  }

  req.apiKey = apiKey;
  next();
};

// Biometric verification middleware (placeholder for future implementation)
const verifyBiometric = (req, res, next) => {
  // This would integrate with biometric verification services
  // For now, it's a placeholder that always passes
  const biometricToken = req.headers['x-biometric-token'];

  if (!biometricToken) {
    return res.status(401).json({
      error: 'Biometric Verification Required',
      message: 'Biometric verification is required for this operation'
    });
  }

  // TODO: Implement actual biometric verification
  // This could involve:
  // 1. Facial recognition
  // 2. Fingerprint verification
  // 3. Voice authentication
  // 4. Behavioral biometrics

  req.biometricVerified = true;
  next();
};

// Rate limiting for sensitive operations
const sensitiveOperationLimiter = (req, res, next) => {
  // Additional rate limiting for sensitive operations like voting
  const userId = req.user?.id || req.ip;

  // This would integrate with Redis for distributed rate limiting
  // For now, it's a simple in-memory check

  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 5; // 5 sensitive operations per minute

  if (!req.app.locals.rateLimit) {
    req.app.locals.rateLimit = new Map();
  }

  const userLimit = req.app.locals.rateLimit.get(userId) || { count: 0, resetTime: now + windowMs };

  if (now > userLimit.resetTime) {
    userLimit.count = 0;
    userLimit.resetTime = now + windowMs;
  }

  if (userLimit.count >= maxRequests) {
    return res.status(429).json({
      error: 'Rate Limit Exceeded',
      message: 'Too many sensitive operations. Please try again later.',
      retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
    });
  }

  userLimit.count++;
  req.app.locals.rateLimit.set(userId, userLimit);

  next();
};

// Audit logging middleware
const auditLog = (action) => {
  return (req, res, next) => {
    const logData = {
      action,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      body: req.method !== 'GET' ? JSON.stringify(req.body).substring(0, 500) : undefined
    };

    winston.info('Audit Log', logData);
    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  optionalAuth,
  authenticateApiKey,
  verifyBiometric,
  sensitiveOperationLimiter,
  auditLog
};