-- =============================================================================
-- PEDIDOS AUTOMATION SYSTEM - PRODUCTION DATABASE SCHEMA
-- =============================================================================
-- Optimized for 400 orders/month, <10s processing time, >95% accuracy
-- Run this complete script in your Supabase SQL Editor
-- =============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For composite indexes on JSONB

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Processing logs table (system monitoring and debugging)
CREATE TABLE IF NOT EXISTS processing_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
  message TEXT NOT NULL,
  source TEXT, -- Service/component that generated the log
  context JSONB DEFAULT '{}', -- Additional structured data
  request_id TEXT, -- For tracing requests across services
  session_id TEXT, -- For grouping related operations
  user_agent TEXT, -- For debugging client issues
  ip_address INET -- For security monitoring
);

-- Main orders table
CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT uuid_generate_v4() UNIQUE, -- For external API references
  numero_pedido VARCHAR(100),
  cliente VARCHAR(300) NOT NULL,
  fecha_pedido DATE NOT NULL,
  canal_origen VARCHAR(20) NOT NULL CHECK (canal_origen IN ('outlook', 'telegram', 'api', 'manual')),
  total_pedido DECIMAL(12,2) CHECK (total_pedido >= 0), -- Increased precision for larger orders
  observaciones TEXT,
  estado VARCHAR(20) DEFAULT 'procesado' CHECK (estado IN ('procesado', 'error', 'pendiente', 'validado', 'facturado', 'cancelado')),
  
  -- Enrichment and metadata
  metadata JSONB DEFAULT '{}', -- Flexible storage for AI processing data
  cliente_codigo_canon VARCHAR(50), -- Canonical client code
  cliente_match_status VARCHAR(20) CHECK (cliente_match_status IN ('exact', 'fuzzy', 'new', 'manual')),
  cliente_match_confidence DECIMAL(3,2) CHECK (cliente_match_confidence >= 0 AND cliente_match_confidence <= 1),
  
  -- Processing tracking
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_completed_at TIMESTAMP WITH TIME ZONE,
  processing_duration_ms INTEGER, -- For performance monitoring
  ai_model_used VARCHAR(50), -- Track which AI model processed this order
  source_file_hash TEXT, -- To prevent duplicate processing
  source_file_name TEXT,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT DEFAULT 'system',
  updated_by TEXT DEFAULT 'system',
  
  -- Soft delete support
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT
);

-- Order line items table
CREATE TABLE IF NOT EXISTS pedido_productos (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  
  -- Product information
  nombre_producto VARCHAR(400) NOT NULL, -- Increased length for complex product names
  cantidad DECIMAL(10,3) NOT NULL CHECK (cantidad > 0), -- Support for fractional quantities
  unidad VARCHAR(50),
  precio_unitario DECIMAL(10,4) CHECK (precio_unitario >= 0), -- Higher precision for unit prices
  total_producto DECIMAL(12,2) NOT NULL CHECK (total_producto >= 0),
  
  -- Product enrichment
  codigo_canon VARCHAR(50), -- Canonical product code
  product_match_status VARCHAR(20) CHECK (product_match_status IN ('exact', 'fuzzy', 'new', 'manual')),
  product_match_confidence DECIMAL(3,2) CHECK (product_match_confidence >= 0 AND product_match_confidence <= 1),
  categoria VARCHAR(100), -- Product category for reporting
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  line_number INTEGER, -- Original line number in source document
  
  -- Soft delete support
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by TEXT
);

-- File processing tracking table
CREATE TABLE IF NOT EXISTS file_processing_log (
  id BIGSERIAL PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash to prevent duplicates
  file_size_bytes BIGINT,
  content_type TEXT,
  source_channel VARCHAR(20) NOT NULL,
  processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  
  -- Processing details
  ai_models_used TEXT[], -- Array of AI models used
  processing_time_ms INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Results
  orders_extracted INTEGER DEFAULT 0,
  extraction_confidence DECIMAL(3,2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================

-- Processing logs indexes (optimized for monitoring and cleanup)
CREATE INDEX IF NOT EXISTS idx_processing_logs_created_at_level ON processing_logs(created_at DESC, level) WHERE level IN ('error', 'warn', 'fatal');
CREATE INDEX IF NOT EXISTS idx_processing_logs_source_time ON processing_logs(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_processing_logs_request_id ON processing_logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_processing_logs_cleanup ON processing_logs(created_at) WHERE level NOT IN ('error', 'fatal');

-- Pedidos indexes (optimized for common queries)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_numero_unique ON pedidos(numero_pedido) WHERE numero_pedido IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_canal ON pedidos(fecha_pedido DESC, canal_origen) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_estado_fecha ON pedidos(estado, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_text ON pedidos USING gin(cliente gin_trgm_ops) WHERE deleted_at IS NULL; -- Fuzzy search
CREATE INDEX IF NOT EXISTS idx_pedidos_created_at ON pedidos(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_uuid ON pedidos(uuid);
CREATE INDEX IF NOT EXISTS idx_pedidos_source_hash ON pedidos(source_file_hash) WHERE source_file_hash IS NOT NULL;

-- Performance monitoring indexes
CREATE INDEX IF NOT EXISTS idx_pedidos_processing_duration ON pedidos(processing_duration_ms DESC) WHERE processing_duration_ms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_processing_status ON pedidos(processing_completed_at) WHERE processing_started_at IS NOT NULL;

-- Metadata search index (for enrichment queries)
CREATE INDEX IF NOT EXISTS idx_pedidos_metadata_gin ON pedidos USING gin(metadata) WHERE metadata != '{}';

-- Pedido productos indexes
CREATE INDEX IF NOT EXISTS idx_pedido_productos_pedido_id ON pedido_productos(pedido_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pedido_productos_nombre_text ON pedido_productos USING gin(nombre_producto gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pedido_productos_codigo_canon ON pedido_productos(codigo_canon) WHERE codigo_canon IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedido_productos_categoria ON pedido_productos(categoria) WHERE categoria IS NOT NULL;

-- File processing indexes
CREATE INDEX IF NOT EXISTS idx_file_processing_hash ON file_processing_log(file_hash);
CREATE INDEX IF NOT EXISTS idx_file_processing_status_time ON file_processing_log(processing_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_processing_channel_time ON file_processing_log(source_channel, created_at DESC);

-- =============================================================================
-- TRIGGERS AND FUNCTIONS
-- =============================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to pedidos
DROP TRIGGER IF EXISTS update_pedidos_updated_at ON pedidos;
CREATE TRIGGER update_pedidos_updated_at 
    BEFORE UPDATE ON pedidos 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Processing time calculation trigger
CREATE OR REPLACE FUNCTION calculate_processing_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.processing_completed_at IS NOT NULL AND NEW.processing_started_at IS NOT NULL THEN
        NEW.processing_duration_ms = EXTRACT(EPOCH FROM (NEW.processing_completed_at - NEW.processing_started_at)) * 1000;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_pedidos_processing_duration
    BEFORE INSERT OR UPDATE ON pedidos
    FOR EACH ROW
    EXECUTE FUNCTION calculate_processing_duration();

-- =============================================================================
-- DATABASE FUNCTIONS FOR PERFORMANCE
-- =============================================================================

-- Enhanced order statistics function
CREATE OR REPLACE FUNCTION get_order_stats(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  canal_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_orders BIGINT,
  total_amount NUMERIC,
  avg_order_value NUMERIC,
  avg_processing_time_ms NUMERIC,
  orders_by_channel JSONB,
  orders_by_status JSONB,
  top_clients JSONB,
  performance_metrics JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_orders AS (
    SELECT 
      canal_origen,
      estado,
      total_pedido,
      cliente,
      processing_duration_ms,
      created_at
    FROM pedidos
    WHERE 
      deleted_at IS NULL
      AND (start_date IS NULL OR fecha_pedido >= start_date) 
      AND (end_date IS NULL OR fecha_pedido <= end_date)
      AND (canal_filter IS NULL OR canal_origen = canal_filter)
  ),
  basic_stats AS (
    SELECT 
      COUNT(*) as order_count,
      COALESCE(SUM(total_pedido), 0) as amount_sum,
      CASE 
        WHEN COUNT(*) > 0 THEN COALESCE(SUM(total_pedido), 0) / COUNT(*)
        ELSE 0
      END as avg_value,
      AVG(processing_duration_ms) as avg_processing_time
    FROM filtered_orders
  ),
  channel_stats AS (
    SELECT jsonb_object_agg(canal_origen, order_count) as channel_json
    FROM (
      SELECT canal_origen, COUNT(*) as order_count
      FROM filtered_orders
      GROUP BY canal_origen
    ) t
  ),
  status_stats AS (
    SELECT jsonb_object_agg(estado, order_count) as status_json
    FROM (
      SELECT estado, COUNT(*) as order_count
      FROM filtered_orders
      GROUP BY estado
    ) t
  ),
  client_stats AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'cliente', cliente,
        'orders', order_count,
        'total_amount', total_amount
      )
    ) as top_clients_json
    FROM (
      SELECT 
        cliente, 
        COUNT(*) as order_count,
        SUM(total_pedido) as total_amount
      FROM filtered_orders
      GROUP BY cliente
      ORDER BY COUNT(*) DESC, SUM(total_pedido) DESC
      LIMIT 10
    ) t
  ),
  performance_stats AS (
    SELECT jsonb_build_object(
      'avg_processing_time_ms', COALESCE(AVG(processing_duration_ms), 0),
      'max_processing_time_ms', COALESCE(MAX(processing_duration_ms), 0),
      'orders_under_10s', COUNT(*) FILTER (WHERE processing_duration_ms <= 10000),
      'total_orders_with_timing', COUNT(*) FILTER (WHERE processing_duration_ms IS NOT NULL)
    ) as perf_json
    FROM filtered_orders
  )
  SELECT 
    basic_stats.order_count,
    basic_stats.amount_sum,
    basic_stats.avg_value,
    basic_stats.avg_processing_time,
    COALESCE(channel_stats.channel_json, '{}'::jsonb),
    COALESCE(status_stats.status_json, '{}'::jsonb),
    COALESCE(client_stats.top_clients_json, '[]'::jsonb),
    performance_stats.perf_json
  FROM basic_stats
  CROSS JOIN channel_stats
  CROSS JOIN status_stats
  CROSS JOIN client_stats
  CROSS JOIN performance_stats;
END;
$$ LANGUAGE plpgsql;

-- Fuzzy search function for orders
CREATE OR REPLACE FUNCTION search_orders_fuzzy(
  search_term TEXT,
  similarity_threshold REAL DEFAULT 0.3,
  max_results INTEGER DEFAULT 50
)
RETURNS TABLE (
  id INTEGER,
  numero_pedido VARCHAR(100),
  cliente VARCHAR(300),
  fecha_pedido DATE,
  total_pedido DECIMAL(12,2),
  similarity_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.numero_pedido,
    p.cliente,
    p.fecha_pedido,
    p.total_pedido,
    GREATEST(
      similarity(p.cliente, search_term),
      similarity(COALESCE(p.numero_pedido, ''), search_term),
      similarity(COALESCE(p.observaciones, ''), search_term)
    ) as similarity_score
  FROM pedidos p
  WHERE 
    p.deleted_at IS NULL
    AND (
      p.cliente % search_term OR
      p.numero_pedido % search_term OR
      p.observaciones % search_term
    )
  ORDER BY similarity_score DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Database maintenance function
CREATE OR REPLACE FUNCTION cleanup_old_data(
  log_retention_days INTEGER DEFAULT 30,
  processing_log_retention_days INTEGER DEFAULT 90
)
RETURNS TABLE (
  logs_deleted BIGINT,
  processing_logs_deleted BIGINT
) AS $$
DECLARE
  deleted_logs BIGINT := 0;
  deleted_processing_logs BIGINT := 0;
BEGIN
  -- Clean up old processing logs (keep errors longer)
  DELETE FROM processing_logs 
  WHERE created_at < NOW() - (log_retention_days || ' days')::INTERVAL
    AND level NOT IN ('error', 'fatal');
  
  GET DIAGNOSTICS deleted_logs = ROW_COUNT;
  
  -- Clean up successful file processing logs
  DELETE FROM file_processing_log
  WHERE created_at < NOW() - (processing_log_retention_days || ' days')::INTERVAL
    AND processing_status = 'completed';
  
  GET DIAGNOSTICS deleted_processing_logs = ROW_COUNT;
  
  RETURN QUERY SELECT deleted_logs, deleted_processing_logs;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SECURITY AND ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_processing_log ENABLE ROW LEVEL SECURITY;

-- Policies for service role (full access)
DROP POLICY IF EXISTS "service_role_all_pedidos" ON pedidos;
CREATE POLICY "service_role_all_pedidos" ON pedidos FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all_pedido_productos" ON pedido_productos;
CREATE POLICY "service_role_all_pedido_productos" ON pedido_productos FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all_processing_logs" ON processing_logs;
CREATE POLICY "service_role_all_processing_logs" ON processing_logs FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all_file_processing" ON file_processing_log;
CREATE POLICY "service_role_all_file_processing" ON file_processing_log FOR ALL USING (auth.role() = 'service_role');

-- Policies for authenticated users (read-only access to non-deleted records)
DROP POLICY IF EXISTS "authenticated_read_pedidos" ON pedidos;
CREATE POLICY "authenticated_read_pedidos" ON pedidos FOR SELECT USING (
  auth.role() = 'authenticated' AND deleted_at IS NULL
);

DROP POLICY IF EXISTS "authenticated_read_pedido_productos" ON pedido_productos;
CREATE POLICY "authenticated_read_pedido_productos" ON pedido_productos FOR SELECT USING (
  auth.role() = 'authenticated' AND deleted_at IS NULL
);

-- Restricted access to logs for authenticated users (only info and above)
DROP POLICY IF EXISTS "authenticated_read_logs" ON processing_logs;
CREATE POLICY "authenticated_read_logs" ON processing_logs FOR SELECT USING (
  auth.role() = 'authenticated' AND level IN ('info', 'warn', 'error', 'fatal')
);

-- =============================================================================
-- GRANTS AND PERMISSIONS
-- =============================================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT SELECT ON pedidos, pedido_productos TO authenticated;
GRANT SELECT ON processing_logs TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_stats TO authenticated;
GRANT EXECUTE ON FUNCTION search_orders_fuzzy TO authenticated;

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Complete orders view (with products)
CREATE OR REPLACE VIEW orders_complete AS
SELECT 
  p.*,
  json_agg(
    json_build_object(
      'id', pp.id,
      'nombre_producto', pp.nombre_producto,
      'cantidad', pp.cantidad,
      'unidad', pp.unidad,
      'precio_unitario', pp.precio_unitario,
      'total_producto', pp.total_producto,
      'codigo_canon', pp.codigo_canon,
      'categoria', pp.categoria
    ) ORDER BY pp.line_number, pp.id
  ) as productos
FROM pedidos p
LEFT JOIN pedido_productos pp ON p.id = pp.pedido_id AND pp.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id;

-- Recent orders view (optimized for dashboard)
CREATE OR REPLACE VIEW recent_orders AS
SELECT 
  p.id,
  p.numero_pedido,
  p.cliente,
  p.fecha_pedido,
  p.canal_origen,
  p.total_pedido,
  p.estado,
  p.processing_duration_ms,
  p.created_at,
  COUNT(pp.id) as productos_count
FROM pedidos p
LEFT JOIN pedido_productos pp ON p.id = pp.pedido_id AND pp.deleted_at IS NULL
WHERE p.deleted_at IS NULL
  AND p.created_at >= NOW() - INTERVAL '30 days'
GROUP BY p.id
ORDER BY p.created_at DESC;

-- Performance monitoring view
CREATE OR REPLACE VIEW performance_monitoring AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  canal_origen,
  COUNT(*) as orders_processed,
  AVG(processing_duration_ms) as avg_processing_time,
  MAX(processing_duration_ms) as max_processing_time,
  COUNT(*) FILTER (WHERE processing_duration_ms > 10000) as slow_orders,
  COUNT(*) FILTER (WHERE estado = 'error') as failed_orders
FROM pedidos
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND processing_duration_ms IS NOT NULL
GROUP BY DATE_TRUNC('hour', created_at), canal_origen
ORDER BY hour DESC;

-- =============================================================================
-- SCHEDULED MAINTENANCE JOBS (for Supabase cron extension if available)
-- =============================================================================

-- Note: These require the pg_cron extension to be enabled in Supabase
-- Uncomment if you have access to pg_cron:

/*
-- Daily cleanup at 2 AM
SELECT cron.schedule('daily-cleanup', '0 2 * * *', $$
  SELECT cleanup_old_data(30, 90);
$$);

-- Weekly statistics update at 3 AM on Sundays
SELECT cron.schedule('weekly-stats', '0 3 * * 0', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS weekly_stats;
$$);
*/

-- =============================================================================
-- FINAL OPTIMIZATIONS
-- =============================================================================

-- Analyze tables for better query planning
ANALYZE pedidos;
ANALYZE pedido_productos;
ANALYZE processing_logs;
ANALYZE file_processing_log;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Pedidos Automation System database schema created successfully!';
  RAISE NOTICE 'Schema includes:';
  RAISE NOTICE '  - Core tables: pedidos, pedido_productos, processing_logs, file_processing_log';
  RAISE NOTICE '  - Performance indexes optimized for 400 orders/month';
  RAISE NOTICE '  - Row Level Security policies configured';
  RAISE NOTICE '  - Database functions for statistics and search';
  RAISE NOTICE '  - Maintenance functions for cleanup';
  RAISE NOTICE '  - Useful views for common queries';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Test the schema with your application';
  RAISE NOTICE '  2. Monitor query performance with pg_stat_statements';
  RAISE NOTICE '  3. Set up automated cleanup jobs if needed';
  RAISE NOTICE '  4. Consider enabling pg_cron for scheduled maintenance';
END;
$$;