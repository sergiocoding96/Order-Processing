#!/usr/bin/env node

/**
 * Database setup and migration script for Order Processing System
 * This script helps validate and set up the Supabase database
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import DatabaseUtils from '../src/config/database-utils.js';
import { testConnection } from '../src/config/database.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseSetup {
  constructor() {
    this.schemaPath = path.join(__dirname, '../src/config/schema.sql');
  }

  async run() {
    console.log('🚀 Order Processing System - Database Setup');
    console.log('==========================================\n');

    try {
      // Step 1: Check environment variables
      await this.checkEnvironment();

      // Step 2: Test connection  
      const connected = await this.testConnection();

      // Step 3: Display schema instructions (always show)
      await this.displaySchemaInstructions();

      // Step 4: Run health check (if connected)
      if (connected) {
        await this.runHealthCheck();
        await this.validateSetup();
      } else {
        console.log('🔧 To complete setup:');
        console.log('1. Execute the schema SQL in your Supabase dashboard');
        console.log('2. Run this script again to validate the setup');
      }

      console.log('\n✅ Database setup completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Run the application: npm run dev');
      console.log('2. Test with a webhook: npm run test:webhook');
      console.log('3. Monitor logs: tail -f logs/combined.log');

    } catch (error) {
      console.error('\n❌ Database setup failed:', error.message);
      process.exit(1);
    }
  }

  async checkEnvironment() {
    console.log('📋 Checking environment variables...');
    
    const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    console.log('✅ All environment variables found\n');
  }

  async testConnection() {
    console.log('🔗 Testing database connection...');
    
    try {
      const connected = await testConnection();
      if (!connected) {
        console.log('⚠️  Database connection failed (tables may not exist yet)');
        console.log('This is normal if you haven\'t run the schema SQL yet.\n');
        return false;
      }

      console.log('✅ Database connection successful\n');
      return true;
    } catch (error) {
      console.log('⚠️  Database connection failed:', error.message);
      console.log('This is normal if you haven\'t run the schema SQL yet.\n');
      return false;
    }
  }

  async runHealthCheck() {
    console.log('🏥 Running database health check...');

    try {
      const health = await DatabaseUtils.healthCheck();
      
      console.log('Connection:', health.connection ? '✅' : '❌');
      
      console.log('\nTables:');
      Object.entries(health.tables).forEach(([table, exists]) => {
        console.log(`  ${table}: ${exists ? '✅' : '❌'}`);
      });

      console.log(`\nIndexes: ${health.indexes.length} found`);
      console.log(`Functions: ${health.functions.length} found`);
      console.log(`Policies: ${health.policies.length} found`);

      if (health.errors.length > 0) {
        console.log('\n⚠️  Errors found:');
        health.errors.forEach(error => console.log(`  - ${error}`));
      }

      console.log();
      return health;
    } catch (error) {
      console.log('❌ Health check failed:', error.message);
      return { connection: false, tables: {}, errors: [error.message] };
    }
  }

  async displaySchemaInstructions() {
    console.log('📊 Database Schema Setup Instructions');
    console.log('=====================================\n');

    if (!fs.existsSync(this.schemaPath)) {
      throw new Error(`Schema file not found: ${this.schemaPath}`);
    }

    const schema = fs.readFileSync(this.schemaPath, 'utf8');
    
    console.log('To set up your database schema:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Create a new query and paste the following SQL:');
    console.log('4. Execute the query to create tables, indexes, and functions\n');

    console.log('📄 Schema SQL (also available in src/config/schema.sql):');
    console.log('=' .repeat(60));
    console.log(schema);
    console.log('=' .repeat(60));
    console.log();
  }

  async validateSetup() {
    console.log('🔍 Validating database setup...');

    const health = await DatabaseUtils.healthCheck();
    const allTablesExist = Object.values(health.tables).every(Boolean);

    if (allTablesExist) {
      console.log('✅ All required tables exist');
      
      // Test basic operations
      try {
        // Test logging
        const { LogsModel } = await import('../src/models/logs.js');
        await LogsModel.write('info', 'Database setup validation', { source: 'setup-script' });
        console.log('✅ Logging functionality working');

        // Test statistics
        const { PedidosModel } = await import('../src/models/pedidos.js');
        await PedidosModel.getStats();
        console.log('✅ Statistics functions working');

        // Run maintenance
        const maintenanceResult = await DatabaseUtils.maintenance();
        if (maintenanceResult.logs_cleaned) {
          console.log('✅ Maintenance operations working');
        }

      } catch (error) {
        console.warn('⚠️  Some functions may not be fully set up:', error.message);
      }

    } else {
      console.log('❌ Some tables are missing. Please run the schema SQL first.');
      
      const missing = Object.entries(health.tables)
        .filter(([, exists]) => !exists)
        .map(([table]) => table);
      
      console.log('Missing tables:', missing.join(', '));
    }

    // Performance check
    try {
      const metrics = await DatabaseUtils.getPerformanceMetrics();
      console.log('\n📈 Database metrics:');
      Object.entries(metrics.table_sizes).forEach(([table, info]) => {
        console.log(`  ${table}: ${info.size}`);
      });
    } catch (error) {
      console.log('⚠️  Could not get performance metrics');
    }
  }
}

// Run the setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new DatabaseSetup();
  setup.run();
}

export default DatabaseSetup;