const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'tanzania-platform' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// If we're not in production then log to the console with a simple format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Request logging middleware
const requestLogger = (req, res, next) => {
  // Generate request ID
  req.requestId = uuidv4();

  // Add request ID to response headers
  res.set('X-Request-ID', req.requestId);

  const start = Date.now();

  // Log request
  logger.info('Request received', {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    body: req.method !== 'GET' && req.body ? JSON.stringify(req.body).substring(0, 500) : undefined
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    logger.log(logLevel, 'Request completed', {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id
    });
  });

  // Log response errors
  res.on('error', (error) => {
    logger.error('Response error', {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      error: error.message,
      stack: error.stack
    });
  });

  next();
};

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds

    // Log slow requests (>500ms)
    if (duration > 500) {
      logger.warn('Slow request detected', {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        duration: `${duration.toFixed(2)}ms`,
        userId: req.user?.id
      });
    }

    // Track performance metrics (could be sent to monitoring system)
    const metrics = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      timestamp: Date.now()
    };

    // TODO: Send to monitoring system (Prometheus, DataDog, etc.)
  });

  next();
};

// Security event logging
const securityLogger = {
  logFailedLogin: (username, ip, reason) => {
    logger.warn('Failed login attempt', {
      event: 'failed_login',
      username,
      ip,
      reason,
      timestamp: new Date().toISOString()
    });
  },

  logSuspiciousActivity: (userId, action, details) => {
    logger.warn('Suspicious activity detected', {
      event: 'suspicious_activity',
      userId,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  },

  logRateLimitExceeded: (identifier, endpoint) => {
    logger.warn('Rate limit exceeded', {
      event: 'rate_limit_exceeded',
      identifier,
      endpoint,
      timestamp: new Date().toISOString()
    });
  },

  logUnauthorizedAccess: (userId, resource, action) => {
    logger.warn('Unauthorized access attempt', {
      event: 'unauthorized_access',
      userId,
      resource,
      action,
      timestamp: new Date().toISOString()
    });
  }
};

// Audit logging for compliance
const auditLogger = {
  logUserAction: (userId, action, resource, details = {}) => {
    logger.info('User action audit', {
      event: 'user_action',
      userId,
      action,
      resource,
      details,
      timestamp: new Date().toISOString(),
      compliance: true
    });
  },

  logAdminAction: (adminId, action, resource, details = {}) => {
    logger.info('Admin action audit', {
      event: 'admin_action',
      adminId,
      action,
      resource,
      details,
      timestamp: new Date().toISOString(),
      compliance: true
    });
  },

  logDataAccess: (userId, dataType, operation, recordId) => {
    logger.info('Data access audit', {
      event: 'data_access',
      userId,
      dataType,
      operation,
      recordId,
      timestamp: new Date().toISOString(),
      compliance: true
    });
  }
};

// Error logging helper
const logError = (error, context = {}) => {
  logger.error('Application error', {
    error: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString()
  });
};

// Info logging helper
const logInfo = (message, context = {}) => {
  logger.info(message, {
    ...context,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  logger,
  requestLogger,
  performanceMonitor,
  securityLogger,
  auditLogger,
  logError,
  logInfo
};