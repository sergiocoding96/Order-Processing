/**
 * Keep-Alive Service for Render Free Tier
 * Prevents service from sleeping during business hours
 * Optimized for webhook reliability
 */

import logger from '../utils/logger.js';

class KeepAliveService {
  constructor() {
    this.interval = null;
    this.isEnabled = process.env.RENDER_FREE_TIER === 'true';
    this.pingInterval = 15 * 60 * 1000; // 15 minutes (increased to reduce API calls)
    this.retryCount = 0;
    this.maxRetries = 3;
    this.businessHours = {
      start: 8, // 8 AM
      end: 20,  // 8 PM
      timezone: 'Europe/Madrid'
    };
  }

  /**
   * Check if current time is within business hours
   */
  isBusinessHours() {
    try {
      const now = new Date();
      const madridTime = new Intl.DateTimeFormat('en-US', {
        timeZone: this.businessHours.timezone,
        hour: 'numeric',
        hour12: false
      }).format(now);
      
      const currentHour = parseInt(madridTime);
      return currentHour >= this.businessHours.start && currentHour < this.businessHours.end;
    } catch (error) {
      logger.error('Error checking business hours', { error: error.message });
      return true; // Default to keeping alive if error
    }
  }

  /**
   * Internal health ping to prevent sleep
   */
  async performKeepAlivePing() {
    try {
      // Internal memory check to keep process active
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      // Reduced logging to prevent log spam
      const now = new Date();
      const shouldLog = uptime < 300 || (now.getMinutes() === 0 && now.getSeconds() < 30); // First 5 minutes or once per hour
      
      if (shouldLog) {
        logger.info('Keep-alive ping', {
          uptime: Math.floor(uptime / 60),
          memoryMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          businessHours: this.isBusinessHours(),
          retries: this.retryCount
        });
      }

      // Only ping database during business hours and with backoff
      if (this.isBusinessHours() && this.retryCount < this.maxRetries) {
        try {
          // Don't import database during startup to avoid connection storms
          if (uptime > 60) { // Wait 1 minute after startup
            const { testConnection } = await import('../config/database.js');
            await testConnection();
            this.retryCount = 0; // Reset on success
          }
        } catch (dbError) {
          this.retryCount++;
          logger.warn(`Keep-alive database ping failed (attempt ${this.retryCount}/${this.maxRetries})`, { 
            error: dbError.message 
          });
          
          // Exponential backoff - wait longer between retries
          if (this.retryCount >= this.maxRetries) {
            logger.warn('Maximum database ping retries reached, pausing database pings');
          }
        }
      }

      return true;
    } catch (error) {
      logger.error('Keep-alive ping failed', { error: error.message });
      return false;
    }
  }

  /**
   * Start keep-alive service
   */
  start() {
    if (!this.isEnabled) {
      logger.info('Keep-alive service disabled (not on Render free tier)');
      return;
    }

    logger.info('Starting keep-alive service', {
      interval: `${this.pingInterval / 1000 / 60} minutes`,
      businessHours: `${this.businessHours.start}:00 - ${this.businessHours.end}:00 ${this.businessHours.timezone}`
    });

    // Perform initial ping
    this.performKeepAlivePing();

    // Set up recurring pings
    this.interval = setInterval(() => {
      this.performKeepAlivePing();
    }, this.pingInterval);
  }

  /**
   * Stop keep-alive service
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Keep-alive service stopped');
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      running: !!this.interval,
      businessHours: this.isBusinessHours(),
      nextPing: this.interval ? new Date(Date.now() + this.pingInterval) : null,
      configuration: {
        interval: `${this.pingInterval / 1000 / 60} minutes`,
        businessHours: `${this.businessHours.start}:00 - ${this.businessHours.end}:00`
      }
    };
  }
}

// Export singleton instance
const keepAliveService = new KeepAliveService();
export default keepAliveService;