import crypto from 'crypto';
import logger from './logger.js';

/**
 * Security utilities for input sanitization and validation
 * Addresses critical security vulnerabilities in JSON parsing and SQL injection
 */
export class SecurityUtils {
  
  // Maximum content sizes to prevent memory attacks
  static MAX_JSON_SIZE = 512 * 1024; // 512KB
  static MAX_TEXT_SIZE = 1024 * 1024; // 1MB
  static MAX_SQL_PARAM_LENGTH = 255;
  
  /**
   * CRITICAL FIX 1: Safe JSON parsing with injection protection
   * Prevents JSON injection attacks by sanitizing and validating JSON content
   */
  static safeJSONParse(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') {
      throw new Error('Invalid JSON input: must be a string');
    }
    
    // Size check to prevent memory exhaustion
    if (jsonString.length > this.MAX_JSON_SIZE) {
      throw new Error(`JSON too large: ${jsonString.length} bytes (max: ${this.MAX_JSON_SIZE})`);
    }
    
    // Remove potential injection patterns
    const sanitized = this.sanitizeJSONString(jsonString);
    
    try {
      const parsed = JSON.parse(sanitized);
      
      // Validate parsed object structure
      if (typeof parsed === 'object' && parsed !== null) {
        return this.validateObjectStructure(parsed);
      }
      
      return parsed;
    } catch (error) {
      logger.error('JSON parsing failed', { 
        error: error.message,
        preview: jsonString.substring(0, 100) 
      });
      throw new Error(`Invalid JSON format: ${error.message}`);
    }
  }
  
  /**
   * Sanitize JSON string to remove potential injection patterns
   */
  static sanitizeJSONString(jsonString) {
    return jsonString
      // Remove null bytes
      .replace(/\0/g, '')
      // Remove control characters except valid JSON whitespace
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Validate structure - must start with { or [
      .replace(/^[^{\[]*([{\[].*[}\]])[^}\]]*$/, '$1');
  }
  
  /**
   * Validate object structure for depth and size
   */
  static validateObjectStructure(obj, depth = 0, maxDepth = 10) {
    if (depth > maxDepth) {
      throw new Error(`Object too deeply nested (max depth: ${maxDepth})`);
    }
    
    if (Array.isArray(obj)) {
      if (obj.length > 1000) {
        throw new Error('Array too large (max: 1000 items)');
      }
      return obj.map(item => 
        typeof item === 'object' && item !== null 
          ? this.validateObjectStructure(item, depth + 1, maxDepth)
          : item
      );
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const keys = Object.keys(obj);
      if (keys.length > 100) {
        throw new Error('Object has too many keys (max: 100)');
      }
      
      const validated = {};
      for (const key of keys) {
        const sanitizedKey = this.sanitizeObjectKey(key);
        validated[sanitizedKey] = typeof obj[key] === 'object' && obj[key] !== null
          ? this.validateObjectStructure(obj[key], depth + 1, maxDepth)
          : this.sanitizeValue(obj[key]);
      }
      return validated;
    }
    
    return this.sanitizeValue(obj);
  }
  
  /**
   * CRITICAL FIX 2: SQL parameter sanitization
   * Prevents SQL injection by sanitizing and validating parameters
   */
  static sanitizeSQLParam(param) {
    if (param === null || param === undefined) {
      return null;
    }
    
    if (typeof param === 'number') {
      if (!Number.isFinite(param)) {
        throw new Error('Invalid number parameter');
      }
      return param;
    }
    
    if (typeof param === 'boolean') {
      return param;
    }
    
    if (typeof param === 'string') {
      // Length check
      if (param.length > this.MAX_SQL_PARAM_LENGTH) {
        throw new Error(`SQL parameter too long: ${param.length} chars (max: ${this.MAX_SQL_PARAM_LENGTH})`);
      }
      
      // Remove null bytes and control characters
      const sanitized = param
        .replace(/\0/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      
      // Check for SQL injection patterns
      if (this.containsSQLInjection(sanitized)) {
        throw new Error('Potentially malicious SQL parameter detected');
      }
      
      return sanitized;
    }
    
    throw new Error(`Invalid SQL parameter type: ${typeof param}`);
  }
  
  /**
   * Check for common SQL injection patterns
   */
  static containsSQLInjection(input) {
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
      /(;|\s--|\/\*|\*\/)/gi,
      /(\b(or|and)\s+\d+\s*=\s*\d+)/gi,
      /('.*'|".*")/g
    ];
    
    return sqlPatterns.some(pattern => pattern.test(input));
  }
  
  /**
   * CRITICAL FIX 3: File upload security
   * Validates file safety and prevents malicious uploads
   */
  static validateFileUpload(file) {
    if (!file || typeof file !== 'object') {
      throw new Error('Invalid file object');
    }
    
    // Required properties check
    const requiredProps = ['originalname', 'mimetype', 'size', 'path'];
    for (const prop of requiredProps) {
      if (!file[prop]) {
        throw new Error(`Missing required file property: ${prop}`);
      }
    }
    
    // File size limits
    const maxSizes = {
      'application/pdf': 10 * 1024 * 1024, // 10MB
      'image/jpeg': 5 * 1024 * 1024,       // 5MB
      'image/png': 5 * 1024 * 1024,        // 5MB
      'text/plain': 1024 * 1024,           // 1MB
      'default': 2 * 1024 * 1024            // 2MB default
    };
    
    const maxSize = maxSizes[file.mimetype] || maxSizes.default;
    if (file.size > maxSize) {
      throw new Error(`File too large: ${file.size} bytes (max: ${maxSize})`);
    }
    
    // Filename sanitization
    const sanitizedName = this.sanitizeFilename(file.originalname);
    if (!sanitizedName || sanitizedName.length === 0) {
      throw new Error('Invalid filename');
    }
    
    // MIME type validation
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`Forbidden file type: ${file.mimetype}`);
    }
    
    return {
      ...file,
      originalname: sanitizedName
    };
  }
  
  /**
   * CRITICAL FIX 4: Memory management utilities
   * Prevents memory exhaustion and optimizes resource usage
   */
  static createMemoryLimitedBuffer(size, maxSize = 10 * 1024 * 1024) {
    if (size > maxSize) {
      throw new Error(`Buffer size ${size} exceeds maximum ${maxSize}`);
    }
    return Buffer.alloc(size);
  }
  
  /**
   * Safe buffer handling for file operations
   */
  static processBufferSafely(buffer, maxSize = 10 * 1024 * 1024) {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Invalid buffer');
    }
    
    if (buffer.length > maxSize) {
      throw new Error(`Buffer too large: ${buffer.length} bytes (max: ${maxSize})`);
    }
    
    // Create a copy to prevent external manipulation
    const safeCopy = Buffer.from(buffer);
    
    // Clear original buffer if possible
    if (buffer.fill) {
      buffer.fill(0);
    }
    
    return safeCopy;
  }
  
  /**
   * Memory-efficient string truncation
   */
  static truncateString(str, maxLength = 1000) {
    if (!str || typeof str !== 'string') {
      return '';
    }
    
    if (str.length <= maxLength) {
      return str;
    }
    
    return str.substring(0, maxLength) + '...';
  }
  
  /**
   * Utility methods
   */
  static sanitizeObjectKey(key) {
    if (typeof key !== 'string') {
      return 'invalid_key';
    }
    
    return key
      .replace(/[^\w.-]/g, '_')
      .substring(0, 50);
  }
  
  static sanitizeValue(value) {
    if (typeof value === 'string') {
      return this.truncateString(value, 1000);
    }
    return value;
  }
  
  static sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'unknown_file';
    }
    
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 100);
  }
  
  /**
   * Generate secure hash for cache keys or identifiers
   */
  static generateSecureHash(input) {
    return crypto.createHash('sha256')
      .update(String(input))
      .digest('hex')
      .substring(0, 16);
  }
  
  /**
   * Rate limiting helper
   */
  static createRateLimit(windowMs = 60000, maxRequests = 100) {
    const requests = new Map();
    
    return (identifier) => {
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Clean old entries
      for (const [key, timestamps] of requests) {
        const filtered = timestamps.filter(time => time > windowStart);
        if (filtered.length === 0) {
          requests.delete(key);
        } else {
          requests.set(key, filtered);
        }
      }
      
      // Check current identifier
      const currentRequests = requests.get(identifier) || [];
      const recentRequests = currentRequests.filter(time => time > windowStart);
      
      if (recentRequests.length >= maxRequests) {
        throw new Error(`Rate limit exceeded for ${identifier}`);
      }
      
      recentRequests.push(now);
      requests.set(identifier, recentRequests);
      
      return true;
    };
  }
}

export default SecurityUtils;