import logger from './logger.js';

/**
 * SECURITY MONITORING AND ALERTING SYSTEM
 * 
 * This module monitors security events and provides alerting capabilities
 * to detect and respond to potential security threats in real-time.
 */

class SecurityMonitor {
  constructor() {
    this.securityEvents = new Map();
    this.alertThresholds = {
      API_ERRORS: 10,          // Alert after 10 API errors in 5 minutes
      FAILED_VALIDATIONS: 5,   // Alert after 5 validation failures in 5 minutes
      RATE_LIMIT_HITS: 3,      // Alert after 3 rate limit violations in 1 minute
      UNUSUAL_ACTIVITY: 20     // Alert after 20 unusual events in 10 minutes
    };
    this.timeWindows = {
      API_ERRORS: 5 * 60 * 1000,          // 5 minutes
      FAILED_VALIDATIONS: 5 * 60 * 1000,  // 5 minutes
      RATE_LIMIT_HITS: 1 * 60 * 1000,     // 1 minute
      UNUSUAL_ACTIVITY: 10 * 60 * 1000    // 10 minutes
    };
  }

  /**
   * Log a security event
   */
  logSecurityEvent(eventType, details = {}) {
    const timestamp = Date.now();
    const event = {
      type: eventType,
      timestamp,
      details,
      id: `${eventType}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`
    };

    // Store event
    if (!this.securityEvents.has(eventType)) {
      this.securityEvents.set(eventType, []);
    }
    
    this.securityEvents.get(eventType).push(event);
    
    // Clean old events
    this.cleanOldEvents(eventType);
    
    // Check if we need to alert
    this.checkAlertThreshold(eventType);
    
    // Log the event
    logger.warn('Security event detected', {
      type: eventType,
      details: this.sanitizeDetails(details),
      eventId: event.id
    });

    return event.id;
  }

  /**
   * Clean events older than the time window
   */
  cleanOldEvents(eventType) {
    const events = this.securityEvents.get(eventType) || [];
    const cutoffTime = Date.now() - this.timeWindows[eventType];
    
    const recentEvents = events.filter(event => event.timestamp > cutoffTime);
    this.securityEvents.set(eventType, recentEvents);
  }

  /**
   * Check if alert threshold is reached
   */
  checkAlertThreshold(eventType) {
    const events = this.securityEvents.get(eventType) || [];
    const threshold = this.alertThresholds[eventType];
    
    if (events.length >= threshold) {
      this.triggerSecurityAlert(eventType, events.length);
    }
  }

  /**
   * Trigger security alert
   */
  triggerSecurityAlert(eventType, eventCount) {
    const alertId = `ALERT_${eventType}_${Date.now()}`;
    
    logger.error('🚨 SECURITY ALERT TRIGGERED', {
      alertId,
      eventType,
      eventCount,
      threshold: this.alertThresholds[eventType],
      timeWindow: this.timeWindows[eventType] / 1000 / 60 // Convert to minutes
    });

    // In production, you could integrate with:
    // - PagerDuty
    // - Slack webhooks  
    // - Email notifications
    // - SMS alerts
    // - Discord/Telegram bots
    
    // For now, create a critical log entry
    this.createAlertLogEntry(alertId, eventType, eventCount);
  }

  /**
   * Create alert log entry
   */
  createAlertLogEntry(alertId, eventType, eventCount) {
    const alertData = {
      id: alertId,
      type: 'SECURITY_ALERT',
      eventType,
      eventCount,
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
      action: 'IMMEDIATE_REVIEW_REQUIRED'
    };

    // Log to security-specific log file if configured
    logger.error('SECURITY_ALERT_LOG_ENTRY', alertData);
  }

  /**
   * Monitor API key usage patterns
   */
  monitorAPIKeyUsage(provider, success, responseTime, tokens = null) {
    const event = {
      provider,
      success,
      responseTime,
      tokens,
      timestamp: Date.now()
    };

    // Check for suspicious patterns
    if (!success) {
      this.logSecurityEvent('API_ERRORS', {
        provider,
        responseTime,
        reason: 'API call failed'
      });
    }

    // Monitor for unusual response times (potential DDoS or abuse)
    if (responseTime > 30000) { // 30 seconds
      this.logSecurityEvent('UNUSUAL_ACTIVITY', {
        type: 'SLOW_API_RESPONSE',
        provider,
        responseTime
      });
    }

    // Monitor for high token usage (potential abuse)
    if (tokens && tokens > 10000) {
      this.logSecurityEvent('UNUSUAL_ACTIVITY', {
        type: 'HIGH_TOKEN_USAGE',
        provider,
        tokens
      });
    }
  }

  /**
   * Monitor authentication events
   */
  monitorAuthEvent(eventType, details = {}) {
    const validAuthEvents = [
      'LOGIN_SUCCESS',
      'LOGIN_FAILURE', 
      'TOKEN_VALIDATION_FAILURE',
      'UNAUTHORIZED_ACCESS_ATTEMPT',
      'PRIVILEGE_ESCALATION_ATTEMPT'
    ];

    if (!validAuthEvents.includes(eventType)) {
      this.logSecurityEvent('UNUSUAL_ACTIVITY', {
        type: 'UNKNOWN_AUTH_EVENT',
        eventType
      });
      return;
    }

    if (eventType.includes('FAILURE') || eventType.includes('ATTEMPT')) {
      this.logSecurityEvent('FAILED_VALIDATIONS', {
        authEventType: eventType,
        ...details
      });
    }

    logger.info('Authentication event', {
      type: eventType,
      details: this.sanitizeDetails(details)
    });
  }

  /**
   * Monitor rate limiting events
   */
  monitorRateLimit(clientId, endpoint, limit, current) {
    if (current >= limit) {
      this.logSecurityEvent('RATE_LIMIT_HITS', {
        clientId: this.hashId(clientId),
        endpoint,
        limit,
        current
      });
    }
  }

  /**
   * Monitor file upload security
   */
  monitorFileUpload(filename, size, mimeType, success, reason = null) {
    const event = {
      filename: this.sanitizeFilename(filename),
      size,
      mimeType,
      success,
      reason
    };

    if (!success) {
      this.logSecurityEvent('FAILED_VALIDATIONS', {
        type: 'FILE_UPLOAD_REJECTED',
        ...event
      });
    }

    // Monitor for suspicious file types or sizes
    const suspiciousMimeTypes = [
      'application/x-executable',
      'application/x-msdownload',
      'application/x-sh'
    ];

    if (suspiciousMimeTypes.includes(mimeType)) {
      this.logSecurityEvent('UNUSUAL_ACTIVITY', {
        type: 'SUSPICIOUS_FILE_TYPE',
        ...event
      });
    }

    // Monitor for unusually large files (potential DoS)
    if (size > 50 * 1024 * 1024) { // 50MB
      this.logSecurityEvent('UNUSUAL_ACTIVITY', {
        type: 'LARGE_FILE_UPLOAD',
        ...event
      });
    }
  }

  /**
   * Get security summary
   */
  getSecuritySummary() {
    const summary = {
      timestamp: new Date().toISOString(),
      events: {}
    };

    for (const [eventType, events] of this.securityEvents.entries()) {
      summary.events[eventType] = {
        count: events.length,
        threshold: this.alertThresholds[eventType],
        timeWindow: this.timeWindows[eventType] / 1000 / 60 // minutes
      };
    }

    return summary;
  }

  /**
   * Sanitize sensitive details for logging
   */
  sanitizeDetails(details) {
    const sanitized = { ...details };
    
    // Remove or hash sensitive fields
    const sensitiveFields = [
      'apiKey', 'token', 'password', 'secret', 'key',
      'authorization', 'cookie', 'session'
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = this.hashSensitiveValue(sanitized[field]);
      }
    }

    return sanitized;
  }

  /**
   * Hash sensitive values for logging
   */
  hashSensitiveValue(value) {
    if (typeof value !== 'string') return '[REDACTED]';
    
    // Show first 3 and last 3 characters with asterisks in between
    if (value.length <= 6) return '[REDACTED]';
    
    return `${value.substring(0, 3)}***${value.substring(value.length - 3)}`;
  }

  /**
   * Hash client/user IDs for privacy
   */
  hashId(id) {
    if (!id) return 'anonymous';
    
    // Simple hash for client identification without exposing actual IDs
    const hash = id.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return `client_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Sanitize filename for logging
   */
  sanitizeFilename(filename) {
    if (!filename) return 'unknown';
    
    // Only show extension for security analysis
    const parts = filename.split('.');
    const extension = parts.length > 1 ? parts.pop() : 'none';
    
    return `[filename].${extension}`;
  }

  /**
   * Reset all security events (for testing or maintenance)
   */
  reset() {
    this.securityEvents.clear();
    logger.info('Security monitor reset - all events cleared');
  }
}

// Create singleton instance
const securityMonitor = new SecurityMonitor();

// Export specific monitoring functions for ease of use
export const logSecurityEvent = (eventType, details) => 
  securityMonitor.logSecurityEvent(eventType, details);

export const monitorAPIKeyUsage = (provider, success, responseTime, tokens) => 
  securityMonitor.monitorAPIKeyUsage(provider, success, responseTime, tokens);

export const monitorAuthEvent = (eventType, details) => 
  securityMonitor.monitorAuthEvent(eventType, details);

export const monitorRateLimit = (clientId, endpoint, limit, current) => 
  securityMonitor.monitorRateLimit(clientId, endpoint, limit, current);

export const monitorFileUpload = (filename, size, mimeType, success, reason) => 
  securityMonitor.monitorFileUpload(filename, size, mimeType, success, reason);

export const getSecuritySummary = () => 
  securityMonitor.getSecuritySummary();

export default securityMonitor;