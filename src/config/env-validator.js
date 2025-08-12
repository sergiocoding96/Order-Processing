import dotenv from 'dotenv';
import logger from '../utils/logger.js';

// Load environment variables
dotenv.config();

/**
 * SECURE ENVIRONMENT CONFIGURATION VALIDATOR
 * 
 * This module validates and secures environment variables to prevent:
 * - API key exposure through logging or error messages
 * - Missing critical configuration
 * - Invalid or malformed secrets
 * - Security vulnerabilities from misconfiguration
 */

// Environment validation schema
const ENV_SCHEMA = {
  // Required environment variables
  required: [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_KEY'
  ],
  
  // Optional but recommended
  optional: [
    'OPENAI_API_KEY',
    'GEMINI_API_KEY', 
    'ANTHROPIC_API_KEY',
    'TELEGRAM_BOT_TOKEN',
    'NODE_ENV',
    'PORT'
  ],

  // Deprecated/removed (will trigger warnings)
  deprecated: [
    'DEEPSEEK_API_KEY'
  ]
};

// Secure patterns for validation (without revealing actual formats)
const VALIDATION_PATTERNS = {
  SUPABASE_URL: /^https:\/\/[a-z0-9]+\.supabase\.co$/,
  SUPABASE_ANON_KEY: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
  SUPABASE_SERVICE_KEY: /^sb_secret_[A-Za-z0-9_-]{40,}$/,
  OPENAI_API_KEY: /^sk-(proj-)?[A-Za-z0-9_-]+$/,
  GEMINI_API_KEY: /^AIza[A-Za-z0-9_-]{35}$/,
  ANTHROPIC_API_KEY: /^sk-ant-[A-Za-z0-9_-]{95,}$/,
  TELEGRAM_BOT_TOKEN: /^[0-9]{8,10}:[A-Za-z0-9_-]{35}$/,
  PORT: /^[0-9]{2,5}$/
};

class EnvironmentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.isValid = true;
  }

  /**
   * Validate all environment variables
   */
  validate() {
    this.checkRequiredVars();
    this.checkDeprecatedVars();
    this.validateFormats();
    this.checkSecuritySettings();
    
    if (this.errors.length > 0) {
      this.isValid = false;
    }

    return {
      isValid: this.isValid,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  /**
   * Check for required environment variables
   */
  checkRequiredVars() {
    for (const varName of ENV_SCHEMA.required) {
      if (!process.env[varName]) {
        this.errors.push(`Missing required environment variable: ${varName}`);
      }
    }
  }

  /**
   * Check for deprecated environment variables
   */
  checkDeprecatedVars() {
    for (const varName of ENV_SCHEMA.deprecated) {
      if (process.env[varName]) {
        this.warnings.push(`Deprecated environment variable detected: ${varName} - Please remove for security`);
      }
    }
  }

  /**
   * Validate environment variable formats without logging sensitive data
   */
  validateFormats() {
    for (const [varName, pattern] of Object.entries(VALIDATION_PATTERNS)) {
      const value = process.env[varName];
      
      if (value && !pattern.test(value)) {
        this.errors.push(`Invalid format for ${varName} - Please check the value`);
      }
    }
  }

  /**
   * Check security-related settings
   */
  checkSecuritySettings() {
    // Check NODE_ENV
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === 'production') {
      // Production security checks
      if (!process.env.RATE_LIMIT_WINDOW_MS) {
        this.warnings.push('RATE_LIMIT_WINDOW_MS not set - using default rate limiting');
      }
      
      if (!process.env.RATE_LIMIT_MAX_REQUESTS) {
        this.warnings.push('RATE_LIMIT_MAX_REQUESTS not set - using default rate limiting');
      }
    }

    // Check for minimum required AI providers
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

    if (!hasOpenAI && !hasGemini && !hasAnthropic) {
      this.errors.push('At least one AI provider API key is required (OpenAI, Gemini, or Anthropic)');
    }

    // Warn about missing optional providers
    if (!hasOpenAI) {
      this.warnings.push('OpenAI API key not configured - vision analysis will not be available');
    }
    if (!hasGemini) {
      this.warnings.push('Gemini API key not configured - primary text processing will fall back to OpenAI');
    }
  }

  /**
   * Get sanitized environment status for logging (without sensitive values)
   */
  getEnvironmentStatus() {
    const status = {
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: process.env.PORT || '3000',
      providers: {
        supabase: !!process.env.SUPABASE_URL,
        openai: !!process.env.OPENAI_API_KEY,
        gemini: !!process.env.GEMINI_API_KEY,
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        telegram: !!process.env.TELEGRAM_BOT_TOKEN
      },
      deprecated_detected: ENV_SCHEMA.deprecated.some(key => !!process.env[key])
    };

    return status;
  }
}

/**
 * Validate environment and return secure configuration
 */
export const validateEnvironment = () => {
  const validator = new EnvironmentValidator();
  const result = validator.validate();
  
  // Log validation results (without sensitive data)
  if (result.errors.length > 0) {
    logger.error('Environment validation failed', { 
      errors: result.errors,
      warnings: result.warnings
    });
    
    // In production, fail fast on validation errors
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Environment validation failed: ${result.errors.join(', ')}`);
    }
  }

  if (result.warnings.length > 0) {
    logger.warn('Environment validation warnings', { warnings: result.warnings });
  }

  if (result.isValid) {
    logger.info('Environment validation passed', validator.getEnvironmentStatus());
  }

  return result;
};

/**
 * Get secure environment configuration for the application
 */
export const getEnvironmentConfig = () => {
  // Validate first
  const validation = validateEnvironment();
  
  if (!validation.isValid) {
    throw new Error('Cannot start application with invalid environment configuration');
  }

  // Return sanitized configuration
  return {
    // Database
    supabase: {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      serviceKey: process.env.SUPABASE_SERVICE_KEY
    },
    
    // AI Providers (only if configured)
    ai: {
      openai: process.env.OPENAI_API_KEY ? { configured: true } : null,
      gemini: process.env.GEMINI_API_KEY ? { configured: true } : null,  
      anthropic: process.env.ANTHROPIC_API_KEY ? { configured: true } : null
    },
    
    // Communication
    telegram: process.env.TELEGRAM_BOT_TOKEN ? { configured: true } : null,
    
    // Application
    app: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT) || 3000,
      webhookBaseUrl: process.env.WEBHOOK_BASE_URL
    },
    
    // Security
    security: {
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
      rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      jwtSecret: process.env.JWT_SECRET
    }
  };
};

/**
 * Check if a specific provider is available
 */
export const isProviderAvailable = (provider) => {
  const config = getEnvironmentConfig();
  
  switch (provider.toLowerCase()) {
    case 'openai':
      return !!config.ai.openai;
    case 'gemini':
      return !!config.ai.gemini;
    case 'anthropic':
      return !!config.ai.anthropic;
    case 'telegram':
      return !!config.telegram;
    case 'supabase':
      return !!(config.supabase.url && config.supabase.anonKey && config.supabase.serviceKey);
    default:
      return false;
  }
};

export default {
  validateEnvironment,
  getEnvironmentConfig, 
  isProviderAvailable
};