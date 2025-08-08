import express from 'express';
import { testConnection } from '../config/database.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    const dbConnection = await testConnection();
    
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: dbConnection ? 'connected' : 'disconnected',
        server: 'running'
      }
    };

    if (!dbConnection) {
      healthStatus.status = 'degraded';
      res.status(503);
    }

    logger.info('Health check performed', { status: healthStatus.status });
    res.json(healthStatus);
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

router.get('/ping', (req, res) => {
  res.json({ message: 'pong', timestamp: new Date().toISOString() });
});

export default router;