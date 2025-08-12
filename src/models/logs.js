import { supabase, supabaseAdmin } from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Enhanced processing logs model for Supabase integration.
 * Provides comprehensive logging, querying, and analytics capabilities.
 */
export class LogsModel {
    static async write(level, message, context = {}) {
        try {
            const payload = {
                level,
                message,
                context,
                source: context.source || 'system'
            };

            const { error } = await supabaseAdmin
                .from('processing_logs')
                .insert(payload);

            if (error) throw error;
        } catch (error) {
            // Do not throw; just log locally
            logger.warn('processing_logs insert failed; using file logger only', { error: error.message, message, level });
        }
    }

    static async findRecent(filters = {}) {
        try {
            let query = supabase
                .from('processing_logs')
                .select('*')
                .order('created_at', { ascending: false });

            if (filters.level) {
                query = query.eq('level', filters.level);
            }

            if (filters.source) {
                query = query.eq('source', filters.source);
            }

            if (filters.hours) {
                const since = new Date();
                since.setHours(since.getHours() - filters.hours);
                query = query.gte('created_at', since.toISOString());
            }

            const { data, error } = await query.limit(filters.limit || 100);

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error('Failed to fetch logs', { error: error.message });
            return [];
        }
    }

    static async getErrorStats(hours = 24) {
        try {
            const since = new Date();
            since.setHours(since.getHours() - hours);

            const { data, error } = await supabase
                .from('processing_logs')
                .select('level, source, created_at, message')
                .gte('created_at', since.toISOString())
                .in('level', ['error', 'warn']);

            if (error) throw error;

            const stats = {
                total_errors: 0,
                total_warnings: 0,
                by_source: {},
                recent_errors: []
            };

            data.forEach(log => {
                if (log.level === 'error') {
                    stats.total_errors++;
                } else if (log.level === 'warn') {
                    stats.total_warnings++;
                }

                stats.by_source[log.source] = (stats.by_source[log.source] || 0) + 1;
                
                if (log.level === 'error' && stats.recent_errors.length < 10) {
                    stats.recent_errors.push({
                        created_at: log.created_at,
                        source: log.source,
                        message: log.message
                    });
                }
            });

            return stats;
        } catch (error) {
            logger.error('Failed to get error stats', { error: error.message });
            return { total_errors: 0, total_warnings: 0, by_source: {}, recent_errors: [] };
        }
    }

    static async cleanup() {
        try {
            const { error } = await supabaseAdmin
                .rpc('cleanup_old_processing_logs');

            if (error) throw error;
            logger.info('Successfully cleaned up old processing logs');
            return true;
        } catch (error) {
            logger.error('Failed to cleanup old logs', { error: error.message });
            return false;
        }
    }
}

export default LogsModel;

