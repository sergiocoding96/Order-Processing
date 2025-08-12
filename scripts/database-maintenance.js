#!/usr/bin/env node

/**
 * Database maintenance script for Order Processing System
 * Run this script periodically to maintain optimal database performance
 */

import DatabaseUtils from '../src/config/database-utils.js';
import { LogsModel } from '../src/models/logs.js';
import logger from '../src/utils/logger.js';

class DatabaseMaintenance {
  constructor() {
    this.startTime = new Date();
  }

  async run() {
    console.log('🔧 Database Maintenance - Order Processing System');
    console.log(`Started at: ${this.startTime.toISOString()}`);
    console.log('='.repeat(50));

    try {
      // Log maintenance start
      await LogsModel.write('info', 'Database maintenance started', {
        source: 'maintenance-script',
        started_at: this.startTime.toISOString()
      });

      // Run health check first
      console.log('\n1. Health Check');
      await this.healthCheck();

      // Clean up old data
      console.log('\n2. Data Cleanup');
      await this.dataCleanup();

      // Update statistics
      console.log('\n3. Statistics Update');
      await this.updateStatistics();

      // Performance analysis
      console.log('\n4. Performance Analysis');
      await this.performanceAnalysis();

      // Generate report
      console.log('\n5. Maintenance Report');
      await this.generateReport();

      const endTime = new Date();
      const duration = endTime - this.startTime;

      console.log(`\n✅ Maintenance completed successfully!`);
      console.log(`Duration: ${Math.round(duration / 1000)}s`);

      await LogsModel.write('info', 'Database maintenance completed', {
        source: 'maintenance-script',
        duration_ms: duration,
        completed_at: endTime.toISOString()
      });

    } catch (error) {
      console.error('\n❌ Maintenance failed:', error.message);
      
      await LogsModel.write('error', 'Database maintenance failed', {
        source: 'maintenance-script',
        error: error.message,
        stack: error.stack
      });

      process.exit(1);
    }
  }

  async healthCheck() {
    try {
      const health = await DatabaseUtils.healthCheck();
      
      console.log('Connection:', health.connection ? '✅' : '❌');
      
      const tablesOk = Object.values(health.tables).every(Boolean);
      console.log('Tables:', tablesOk ? '✅' : '❌');
      
      console.log(`Indexes: ${health.indexes.length}`);
      console.log(`Functions: ${health.functions.length}`);
      console.log(`Policies: ${health.policies.length}`);

      if (health.errors.length > 0) {
        console.log('⚠️  Issues found:');
        health.errors.forEach(error => console.log(`  - ${error}`));
      }

      return health;
    } catch (error) {
      console.error('Health check failed:', error.message);
      throw error;
    }
  }

  async dataCleanup() {
    try {
      const result = await DatabaseUtils.maintenance();
      
      console.log('Log cleanup:', result.logs_cleaned ? '✅' : '❌');
      console.log('Stats update:', result.stats_updated ? '✅' : '❌');

      if (result.errors.length > 0) {
        console.log('⚠️  Cleanup issues:');
        result.errors.forEach(error => console.log(`  - ${error}`));
      }

      return result;
    } catch (error) {
      console.error('Data cleanup failed:', error.message);
      throw error;
    }
  }

  async updateStatistics() {
    try {
      // Get current order statistics
      const { PedidosModel } = await import('../src/models/pedidos.js');
      
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];

      const todayStats = await PedidosModel.getStats({
        fecha_desde: today,
        fecha_hasta: today
      });

      const weekStats = await PedidosModel.getStats({
        fecha_desde: weekAgoStr,
        fecha_hasta: today
      });

      console.log(`Today: ${todayStats.total_orders} orders, €${todayStats.total_amount.toFixed(2)}`);
      console.log(`This week: ${weekStats.total_orders} orders, €${weekStats.total_amount.toFixed(2)}`);

      return { todayStats, weekStats };
    } catch (error) {
      console.error('Statistics update failed:', error.message);
      throw error;
    }
  }

  async performanceAnalysis() {
    try {
      const metrics = await DatabaseUtils.getPerformanceMetrics();
      
      console.log('Database sizes:');
      Object.entries(metrics.table_sizes).forEach(([table, info]) => {
        console.log(`  ${table}: ${info.size}`);
      });

      // Check for potential issues
      const warnings = [];
      
      Object.entries(metrics.table_sizes).forEach(([table, info]) => {
        if (info.size_bytes > 100 * 1024 * 1024) { // 100MB
          warnings.push(`Table ${table} is large (${info.size})`);
        }
      });

      if (warnings.length > 0) {
        console.log('\n⚠️  Performance warnings:');
        warnings.forEach(warning => console.log(`  - ${warning}`));
      }

      return metrics;
    } catch (error) {
      console.error('Performance analysis failed:', error.message);
      // Don't throw, this is optional
      return {};
    }
  }

  async generateReport() {
    try {
      // Get error statistics
      const errorStats = await LogsModel.getErrorStats(24);
      
      console.log('\n📊 24h Error Report:');
      console.log(`Errors: ${errorStats.total_errors}`);
      console.log(`Warnings: ${errorStats.total_warnings}`);
      
      if (Object.keys(errorStats.by_source).length > 0) {
        console.log('By source:');
        Object.entries(errorStats.by_source).forEach(([source, count]) => {
          console.log(`  ${source}: ${count}`);
        });
      }

      if (errorStats.recent_errors.length > 0) {
        console.log('\nRecent errors:');
        errorStats.recent_errors.slice(0, 3).forEach(error => {
          console.log(`  - ${error.source}: ${error.message}`);
        });
      }

      // Export data (optional)
      if (process.argv.includes('--export')) {
        console.log('\n📤 Exporting database...');
        const exportData = await DatabaseUtils.exportToJson();
        
        const filename = `database_export_${new Date().toISOString().split('T')[0]}.json`;
        const fs = await import('fs');
        fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
        
        console.log(`✅ Database exported to ${filename}`);
      }

      return errorStats;
    } catch (error) {
      console.error('Report generation failed:', error.message);
      // Don't throw, this is optional
      return {};
    }
  }
}

// Command line options
const showHelp = () => {
  console.log('Database Maintenance Script');
  console.log('Usage: node scripts/database-maintenance.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --export    Export database to JSON file');
  console.log('  --help      Show this help message');
};

// Run the maintenance if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--help')) {
    showHelp();
    process.exit(0);
  }

  const maintenance = new DatabaseMaintenance();
  maintenance.run();
}

export default DatabaseMaintenance;