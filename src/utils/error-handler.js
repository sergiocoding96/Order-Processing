import logger from './logger.js';

export class ErrorHandler {
  
  /**
   * Enhanced error handling for AI processing
   */
  static handleAIError(error, context = {}) {
    const errorInfo = {
      message: error.message,
      type: this.classifyError(error),
      context,
      timestamp: new Date().toISOString(),
      stack: error.stack
    };

    logger.error('AI processing error', errorInfo);

    // Return user-friendly error based on type
    switch (errorInfo.type) {
      case 'api_key_invalid':
        return {
          userMessage: 'AI service configuration error',
          retryable: false,
          severity: 'high'
        };
      
      case 'rate_limit':
        return {
          userMessage: 'AI service temporarily unavailable due to high demand',
          retryable: true,
          retryAfter: 60000, // 1 minute
          severity: 'medium'
        };
      
      case 'network_error':
        return {
          userMessage: 'Network connectivity issue',
          retryable: true,
          retryAfter: 30000, // 30 seconds
          severity: 'medium'
        };
      
      case 'content_too_large':
        return {
          userMessage: 'Content too large to process',
          retryable: false,
          severity: 'low'
        };
      
      case 'parsing_error':
        return {
          userMessage: 'AI response could not be parsed',
          retryable: true,
          retryAfter: 10000, // 10 seconds
          severity: 'medium'
        };
      
      default:
        return {
          userMessage: 'AI processing failed',
          retryable: true,
          retryAfter: 30000,
          severity: 'medium'
        };
    }
  }

  /**
   * Classify error type for appropriate handling
   */
  static classifyError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('api key') || message.includes('unauthorized') || message.includes('401')) {
      return 'api_key_invalid';
    }
    
    if (message.includes('rate limit') || message.includes('429') || message.includes('quota')) {
      return 'rate_limit';
    }
    
    if (message.includes('network') || message.includes('timeout') || message.includes('econnrefused')) {
      return 'network_error';
    }
    
    if (message.includes('too large') || message.includes('413') || message.includes('payload')) {
      return 'content_too_large';
    }
    
    if (message.includes('json') || message.includes('parse') || message.includes('syntax')) {
      return 'parsing_error';
    }
    
    return 'unknown';
  }

  /**
   * Enhanced database error handling
   */
  static handleDatabaseError(error, operation = 'unknown') {
    const errorInfo = {
      message: error.message,
      operation,
      code: error.code,
      timestamp: new Date().toISOString()
    };

    logger.error('Database error', errorInfo);

    // Handle specific database errors
    if (error.code === 'PGRST116') {
      return {
        userMessage: 'Database table not found - schema may need to be created',
        retryable: false,
        severity: 'high'
      };
    }

    if (error.code === '23505') { // Unique constraint violation
      return {
        userMessage: 'Duplicate record detected',
        retryable: false,
        severity: 'low'
      };
    }

    if (error.code === '23503') { // Foreign key violation
      return {
        userMessage: 'Data relationship error',
        retryable: false,
        severity: 'medium'
      };
    }

    return {
      userMessage: 'Database operation failed',
      retryable: true,
      retryAfter: 5000,
      severity: 'high'
    };
  }

  /**
   * Handle webhook processing errors
   */
  static handleWebhookError(error, source = 'unknown') {
    const errorInfo = {
      message: error.message,
      source,
      timestamp: new Date().toISOString()
    };

    logger.error('Webhook processing error', errorInfo);

    return {
      userMessage: 'Webhook processing failed',
      retryable: true,
      retryAfter: 10000,
      severity: 'medium'
    };
  }

  /**
   * Create standardized error response
   */
  static createErrorResponse(error, context = {}) {
    let handledError;

    if (context.type === 'ai') {
      handledError = this.handleAIError(error, context);
    } else if (context.type === 'database') {
      handledError = this.handleDatabaseError(error, context.operation);
    } else if (context.type === 'webhook') {
      handledError = this.handleWebhookError(error, context.source);
    } else {
      handledError = {
        userMessage: 'An unexpected error occurred',
        retryable: false,
        severity: 'medium'
      };
    }

    return {
      success: false,
      error: {
        message: handledError.userMessage,
        retryable: handledError.retryable,
        retryAfter: handledError.retryAfter,
        severity: handledError.severity,
        timestamp: new Date().toISOString()
      },
      context: context.type || 'unknown'
    };
  }

  /**
   * Determine if error should trigger immediate retry
   */
  static shouldRetryImmediately(error) {
    const retryableTypes = ['network_error', 'rate_limit', 'parsing_error'];
    const errorType = this.classifyError(error);
    return retryableTypes.includes(errorType);
  }

  /**
   * Calculate retry delay based on error type and attempt count
   */
  static calculateRetryDelay(error, attemptCount = 1) {
    const errorType = this.classifyError(error);
    const baseDelay = 1000; // 1 second
    
    const delays = {
      'network_error': baseDelay * 2, // 2 seconds
      'rate_limit': baseDelay * 60, // 1 minute
      'parsing_error': baseDelay * 5, // 5 seconds
      'unknown': baseDelay * 10 // 10 seconds
    };

    const delay = delays[errorType] || delays.unknown;
    
    // Exponential backoff with jitter
    const exponentialDelay = delay * Math.pow(2, attemptCount - 1);
    const jitter = Math.random() * 1000; // Up to 1 second jitter
    
    return Math.min(exponentialDelay + jitter, 300000); // Max 5 minutes
  }

  /**
   * Log error with appropriate level based on severity
   */
  static logError(error, context = {}) {
    const handledError = this.createErrorResponse(error, context);
    
    switch (handledError.error.severity) {
      case 'high':
        logger.error('High severity error', { error, context });
        break;
      case 'medium':
        logger.warn('Medium severity error', { error, context });
        break;
      case 'low':
        logger.info('Low severity error', { error, context });
        break;
      default:
        logger.error('Unknown severity error', { error, context });
    }
  }
}

export default ErrorHandler;