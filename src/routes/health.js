import express from 'express';
import { testConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import keepAliveService from '../services/keep-alive.js';

const router = express.Router();

router.get('/health', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Simple health check to prevent 429 errors during startup
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    let dbConnection = true; // Assume healthy initially
    
    // Only test database connection after 30 seconds uptime to prevent startup 429s
    if (uptime > 30) {
      try {
        dbConnection = await Promise.race([
          testConnection(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), 3000))
        ]);
      } catch (dbError) {
        dbConnection = false;
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      platform: 'render',
      responseTime: `${responseTime}ms`,
      memory: {
        used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        limit: '512MB'
      },
      services: {
        database: dbConnection ? 'connected' : 'disconnected',
        server: 'running',
        keepAlive: keepAliveService.getStatus()
      }
    };

    // Health status logic optimized for webhook reliability
    if (!dbConnection) {
      healthStatus.status = 'degraded';
      res.status(503);
    } else if (responseTime > 3000) {
      healthStatus.status = 'slow';
      res.status(200); // Still healthy, just slow
    } else if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.9) {
      healthStatus.status = 'high_memory';
      healthStatus.warning = 'High memory usage detected';
      res.status(200);
    }

    // Only log in development or on errors to reduce log noise on free tier
    if (process.env.NODE_ENV !== 'production' || healthStatus.status !== 'ok') {
      logger.info('Health check performed', { 
        status: healthStatus.status, 
        responseTime,
        memoryMB: Math.round(memoryUsage.heapUsed / 1024 / 1024)
      });
    }
    
    res.json(healthStatus);
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Health check failed', { error: error.message, responseTime });
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: process.env.NODE_ENV === 'production' ? 'Service temporarily unavailable' : error.message,
      responseTime: `${responseTime}ms`
    });
  }
});

router.get('/ping', (req, res) => {
  res.json({ message: 'pong', timestamp: new Date().toISOString() });
});

export default router;