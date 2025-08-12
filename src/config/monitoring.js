import logger from '../utils/logger.js';

/**
 * Production monitoring configuration for Railway deployment
 */

// Performance monitoring
export const performanceMonitor = {
  trackRequest: (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const { method, path, ip } = req;
      const { statusCode } = res;
      
      logger.info('Request completed', {
        method,
        path,
        statusCode,
        duration: `${duration}ms`,
        ip,
        userAgent: req.get('User-Agent')
      });

      // Alert on slow requests (>5s for order processing)
      if (duration > 5000) {
        logger.warn('Slow request detected', {
          method,
          path,
          duration: `${duration}ms`,
          statusCode
        });
      }

      // Alert on errors
      if (statusCode >= 500) {
        logger.error('Server error occurred', {
          method,
          path,
          statusCode,
          duration: `${duration}ms`
        });
      }
    });
    
    next();
  }
};

// Health check metrics
export const healthMetrics = {
  getSystemHealth: async () => {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      environment: process.env.NODE_ENV
    };

    // Database health check
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      
      const { data, error } = await supabase
        .from('processing_logs')
        .select('count')
        .limit(1);
        
      metrics.database = error ? 'unhealthy' : 'healthy';
    } catch (err) {
      metrics.database = 'unhealthy';
      logger.error('Database health check failed', { error: err.message });
    }

    // AI Services health check
    metrics.aiServices = {
      openai: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
      gemini: process.env.GEMINI_API_KEY ? 'configured' : 'missing',
      telegram: process.env.TELEGRAM_BOT_TOKEN ? 'configured' : 'missing'
    };

    return metrics;
  }
};

// Resource usage monitoring
export const resourceMonitor = {
  logMemoryUsage: () => {
    const usage = process.memoryUsage();
    const mbUsage = {
      rss: Math.round(usage.rss / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024)
    };

    logger.info('Memory usage', mbUsage);

    // Alert if memory usage exceeds 400MB (Railway starter plan has 512MB)
    if (mbUsage.rss > 400) {
      logger.warn('High memory usage detected', mbUsage);
    }

    return mbUsage;
  },

  startPeriodicMonitoring: () => {
    // Log memory usage every 10 minutes
    setInterval(() => {
      resourceMonitor.logMemoryUsage();
    }, 10 * 60 * 1000);

    logger.info('Resource monitoring started');
  }
};

// Error rate monitoring
export const errorMonitor = {
  errorCounts: {
    total: 0,
    lastHour: 0,
    hourlyReset: Date.now()
  },

  logError: (error, context = {}) => {
    errorMonitor.errorCounts.total++;
    
    // Reset hourly counter
    const now = Date.now();
    if (now - errorMonitor.errorCounts.hourlyReset > 3600000) {
      errorMonitor.errorCounts.lastHour = 0;
      errorMonitor.errorCounts.hourlyReset = now;
    }
    
    errorMonitor.errorCounts.lastHour++;

    logger.error('Application error', {
      error: error.message,
      stack: error.stack,
      totalErrors: errorMonitor.errorCounts.total,
      errorsLastHour: errorMonitor.errorCounts.lastHour,
      ...context
    });

    // Alert on high error rates (>10 errors per hour)
    if (errorMonitor.errorCounts.lastHour > 10) {
      logger.error('High error rate detected', {
        errorsLastHour: errorMonitor.errorCounts.lastHour,
        threshold: 10
      });
    }
  },

  getErrorStats: () => errorMonitor.errorCounts
};

export default {
  performanceMonitor,
  healthMetrics,
  resourceMonitor,
  errorMonitor
};