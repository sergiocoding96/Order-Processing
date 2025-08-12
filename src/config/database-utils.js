import { supabase, supabaseAdmin, testConnection } from './database.js';
import logger from '../utils/logger.js';

/**
 * Database utility functions for the order processing system.
 * Provides health checks, migrations, and maintenance operations.
 */
export class DatabaseUtils {
  
  /**
   * Test database connectivity and table existence
   */
  static async healthCheck() {
    const results = {
      connection: false,
      tables: {
        pedidos: false,
        pedido_productos: false,
        processing_logs: false
      },
      indexes: [],
      functions: [],
      policies: [],
      errors: []
    };

    try {
      // Test basic connection
      results.connection = await testConnection();

      if (results.connection) {
        // Check table existence and structure
        const tables = ['pedidos', 'pedido_productos', 'processing_logs'];
        
        for (const table of tables) {
          try {
            const { error } = await supabase
              .from(table)
              .select('*')
              .limit(1);
            
            results.tables[table] = !error;
            if (error) results.errors.push(`Table ${table}: ${error.message}`);
          } catch (err) {
            results.tables[table] = false;
            results.errors.push(`Table ${table}: ${err.message}`);
          }
        }

        // Check indexes
        try {
          const { data: indexes, error } = await supabaseAdmin
            .rpc('sql', {
              query: `
                SELECT indexname, tablename 
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND indexname LIKE 'idx_%'
                ORDER BY tablename, indexname;
              `
            });

          if (!error && indexes) {
            results.indexes = indexes;
          }
        } catch (err) {
          results.errors.push(`Indexes check: ${err.message}`);
        }

        // Check custom functions
        try {
          const { data: functions, error } = await supabaseAdmin
            .rpc('sql', {
              query: `
                SELECT routine_name
                FROM information_schema.routines
                WHERE routine_schema = 'public'
                AND routine_name IN ('get_order_stats', 'cleanup_old_processing_logs');
              `
            });

          if (!error && functions) {
            results.functions = functions.map(f => f.routine_name);
          }
        } catch (err) {
          results.errors.push(`Functions check: ${err.message}`);
        }

        // Check RLS policies
        try {
          const { data: policies, error } = await supabaseAdmin
            .rpc('sql', {
              query: `
                SELECT tablename, policyname, permissive
                FROM pg_policies
                WHERE schemaname = 'public'
                ORDER BY tablename;
              `
            });

          if (!error && policies) {
            results.policies = policies;
          }
        } catch (err) {
          results.errors.push(`Policies check: ${err.message}`);
        }
      }

    } catch (error) {
      results.errors.push(`Health check failed: ${error.message}`);
    }

    return results;
  }

  /**
   * Run database migrations and setup
   */
  static async migrate() {
    try {
      logger.info('Starting database migration...');

      // Read and execute the schema file content
      // Note: In production, you should run migrations via Supabase dashboard
      // This is a programmatic approach for development
      
      const migrationStatus = {
        tables_created: false,
        indexes_created: false,
        functions_created: false,
        policies_created: false,
        errors: []
      };

      // The actual migration should be run manually in Supabase
      // This function serves as a validation
      const healthCheck = await this.healthCheck();
      
      migrationStatus.tables_created = Object.values(healthCheck.tables).every(Boolean);
      migrationStatus.indexes_created = healthCheck.indexes.length > 0;
      migrationStatus.functions_created = healthCheck.functions.length >= 2;
      migrationStatus.policies_created = healthCheck.policies.length > 0;
      migrationStatus.errors = healthCheck.errors;

      logger.info('Migration validation completed', migrationStatus);
      return migrationStatus;

    } catch (error) {
      logger.error('Migration failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Database maintenance operations
   */
  static async maintenance() {
    const results = {
      logs_cleaned: false,
      stats_updated: false,
      vacuum_completed: false,
      errors: []
    };

    try {
      // Clean old logs (older than 30 days)
      try {
        const { error } = await supabaseAdmin.rpc('cleanup_old_processing_logs');
        results.logs_cleaned = !error;
        if (error) results.errors.push(`Log cleanup: ${error.message}`);
      } catch (err) {
        results.errors.push(`Log cleanup: ${err.message}`);
      }

      // Update table statistics (PostgreSQL ANALYZE)
      try {
        const { error } = await supabaseAdmin
          .rpc('sql', {
            query: 'ANALYZE pedidos, pedido_productos, processing_logs;'
          });
        results.stats_updated = !error;
        if (error) results.errors.push(`Stats update: ${error.message}`);
      } catch (err) {
        results.errors.push(`Stats update: ${err.message}`);
      }

      logger.info('Database maintenance completed', results);
      return results;

    } catch (error) {
      logger.error('Maintenance failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get database performance metrics
   */
  static async getPerformanceMetrics() {
    try {
      const metrics = {
        connection_count: 0,
        table_sizes: {},
        slow_queries: [],
        index_usage: {},
        cache_hit_ratio: 0
      };

      // Get table sizes
      try {
        const { data: sizes, error } = await supabaseAdmin
          .rpc('sql', {
            query: `
              SELECT 
                schemaname,
                tablename,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
                pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
              FROM pg_tables 
              WHERE schemaname = 'public'
              AND tablename IN ('pedidos', 'pedido_productos', 'processing_logs')
              ORDER BY size_bytes DESC;
            `
          });

        if (!error && sizes) {
          sizes.forEach(table => {
            metrics.table_sizes[table.tablename] = {
              size: table.size,
              size_bytes: table.size_bytes
            };
          });
        }
      } catch (err) {
        logger.warn('Could not get table sizes', { error: err.message });
      }

      return metrics;
    } catch (error) {
      logger.error('Failed to get performance metrics', { error: error.message });
      throw error;
    }
  }

  /**
   * Backup database to JSON (development only)
   */
  static async exportToJson() {
    try {
      logger.info('Starting database export...');

      const export_data = {
        exported_at: new Date().toISOString(),
        tables: {}
      };

      // Export pedidos
      const { data: pedidos, error: pedidosError } = await supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: true });

      if (!pedidosError && pedidos) {
        export_data.tables.pedidos = pedidos;
      }

      // Export pedido_productos
      const { data: productos, error: productosError } = await supabase
        .from('pedido_productos')
        .select('*')
        .order('pedido_id', { ascending: true });

      if (!productosError && productos) {
        export_data.tables.pedido_productos = productos;
      }

      // Export recent processing_logs (last 7 days only)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: logs, error: logsError } = await supabase
        .from('processing_logs')
        .select('*')
        .gte('created_at', weekAgo.toISOString())
        .order('created_at', { ascending: true });

      if (!logsError && logs) {
        export_data.tables.processing_logs = logs;
      }

      logger.info('Database export completed', {
        pedidos_count: pedidos?.length || 0,
        productos_count: productos?.length || 0,
        logs_count: logs?.length || 0
      });

      return export_data;
    } catch (error) {
      logger.error('Database export failed', { error: error.message });
      throw error;
    }
  }
}

export default DatabaseUtils;