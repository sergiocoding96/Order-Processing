/**
 * Monitoring Routes for Render Free Tier
 * Provides detailed metrics and status information
 */

import express from 'express';
import logger from '../utils/logger.js';
import keepAliveService from '../services/keep-alive.js';

const router = express.Router();

// Lightweight ping endpoint for external monitoring services
router.get('/ping', (req, res) => {
  res.json({ 
    message: 'pong', 
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// Detailed metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Gather system metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();
    
    // Environment information
    const nodeVersion = process.version;
    const platform = process.platform;
    const arch = process.arch;
    
    // Free tier specific metrics
    const memoryLimitMB = parseInt(process.env.MEMORY_LIMIT_MB) || 512;
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const memoryUsagePercent = Math.round((memoryUsedMB / memoryLimitMB) * 100);
    
    // Calculate estimated hours used this month (approximation)
    const hoursRunning = Math.round(uptime / 3600);
    const dayOfMonth = new Date().getDate();
    const estimatedMonthlyHours = Math.round((hoursRunning / dayOfMonth) * 31);
    
    const metrics = {
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`,
      
      // System metrics
      system: {
        nodeVersion,
        platform,
        arch,
        uptime: {
          seconds: Math.floor(uptime),
          hours: Math.round(uptime / 3600 * 100) / 100,
          formatted: formatUptime(uptime)
        }
      },
      
      // Memory metrics
      memory: {
        used: `${memoryUsedMB}MB`,
        total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        limit: `${memoryLimitMB}MB`,
        usagePercent: memoryUsagePercent,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
        arrayBuffers: `${Math.round(memoryUsage.arrayBuffers / 1024 / 1024)}MB`
      },
      
      // CPU metrics (approximate)
      cpu: {
        user: Math.round(cpuUsage.user / 1000),  // Convert microseconds to milliseconds
        system: Math.round(cpuUsage.system / 1000)
      },
      
      // Free tier specific
      renderFreeTier: {
        enabled: process.env.RENDER_FREE_TIER === 'true',
        estimatedHoursUsed: hoursRunning,
        estimatedMonthlyHours: estimatedMonthlyHours,
        monthlyLimit: 750,
        percentageUsed: Math.min(Math.round((estimatedMonthlyHours / 750) * 100), 100),
        warningThreshold: estimatedMonthlyHours > 600, // Warn at 80% usage
        criticalThreshold: estimatedMonthlyHours > 700 // Critical at 93% usage
      },
      
      // Service status
      services: {
        keepAlive: keepAliveService.getStatus(),
        environment: process.env.NODE_ENV || 'development'
      },
      
      // Performance indicators
      performance: {
        memoryPressure: memoryUsagePercent > 80 ? 'high' : memoryUsagePercent > 60 ? 'medium' : 'low',
        uptimeStability: uptime > 86400 ? 'excellent' : uptime > 3600 ? 'good' : 'starting',
        healthStatus: calculateHealthStatus(memoryUsagePercent, uptime)
      }
    };
    
    // Add warnings if needed
    const warnings = [];
    if (memoryUsagePercent > 85) warnings.push('High memory usage detected');
    if (estimatedMonthlyHours > 700) warnings.push('Approaching free tier limit');
    if (uptime < 300) warnings.push('Service recently restarted');
    
    if (warnings.length > 0) {
      metrics.warnings = warnings;
    }
    
    res.json(metrics);
    
  } catch (error) {
    logger.error('Metrics endpoint error', { error: error.message });
    res.status(500).json({
      error: 'Failed to gather metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// Status endpoint optimized for monitoring services
router.get('/status', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const memoryLimitMB = parseInt(process.env.MEMORY_LIMIT_MB) || 512;
  
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    memory: memoryUsedMB,
    memoryLimit: memoryLimitMB,
    healthy: memoryUsedMB < (memoryLimitMB * 0.9) && uptime > 60
  };
  
  // Return appropriate HTTP status
  if (!status.healthy) {
    res.status(503);
    status.status = 'degraded';
  }
  
  res.json(status);
});

// Helper functions
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function calculateHealthStatus(memoryPercent, uptime) {
  if (memoryPercent > 90) return 'critical';
  if (memoryPercent > 80 || uptime < 300) return 'warning';
  if (uptime > 3600 && memoryPercent < 70) return 'excellent';
  return 'good';
}

export default router;