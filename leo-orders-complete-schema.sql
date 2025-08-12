-- =============================================================================
-- LEO ORDERS - COMPLETE PRODUCTION DATABASE SCHEMA
-- =============================================================================
-- Optimized for 400 orders/month, <10s processing time, >95% accuracy
-- Includes hybrid code matching system and all production features
-- Deploy this complete script in your new Supabase project
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
-- HYBRID CODE MATCHING SYSTEM TABLES
-- =============================================================================

-- Canonical client registry
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

-- Client aliases for fuzzy matching
CREATE TABLE IF NOT EXISTS client_aliases (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  alias TEXT UNIQUE NOT NULL,
  metadata JSONB DEFAULT '{}',
  match_confidence DECIMAL(3,2) DEFAULT 1.0, -- Confidence of this alias match
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(20) DEFAULT 'system' -- 'system', 'manual', 'ai'
);

-- Canonical product registry
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

-- Product aliases for fuzzy matching
CREATE TABLE IF NOT EXISTS product_aliases (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  alias TEXT UNIQUE NOT NULL,
  metadata JSONB DEFAULT '{}',
  match_confidence DECIMAL(3,2) DEFAULT 1.0, -- Confidence of this alias match
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(20) DEFAULT 'system' -- 'system', 'manual', 'ai'
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

-- Canonical code indexes
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_codigo_canon ON pedidos(cliente_codigo_canon) WHERE cliente_codigo_canon IS NOT NULL;

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

-- Hybrid code matching indexes
CREATE INDEX IF NOT EXISTS idx_clients_code ON clients(code) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_clients_name_text ON clients USING gin(name gin_trgm_ops) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_client_aliases_alias_text ON client_aliases USING gin(alias gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_client_aliases_client_id ON client_aliases(client_id);

CREATE INDEX IF NOT EXISTS idx_products_code ON products(code) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_name_text ON products USING gin(name gin_trgm_ops) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_product_aliases_alias_text ON product_aliases USING gin(alias gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_product_aliases_product_id ON product_aliases(product_id);

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

-- Apply updated_at trigger to clients
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at 
    BEFORE UPDATE ON clients 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to products
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products 
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

-- Client lookup function for CodeMatcher
CREATE OR REPLACE FUNCTION find_client_by_name_fuzzy(
  client_name TEXT,
  similarity_threshold REAL DEFAULT 0.9
)
RETURNS TABLE (
  client_code VARCHAR(100),
  client_name_canonical VARCHAR(255),
  match_type VARCHAR(20),
  confidence REAL,
  alias_used TEXT
) AS $$
BEGIN
  -- First try exact code match
  RETURN QUERY
  SELECT 
    c.code,
    c.name,
    'exact'::VARCHAR(20),
    1.0::REAL,
    NULL::TEXT
  FROM clients c
  WHERE c.code = client_name AND c.active = TRUE
  LIMIT 1;

  -- If no exact code match, try exact alias match
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      c.code,
      c.name,
      'exact'::VARCHAR(20),
      ca.match_confidence::REAL,
      ca.alias
    FROM client_aliases ca
    JOIN clients c ON ca.client_id = c.id
    WHERE ca.alias = client_name AND c.active = TRUE
    ORDER BY ca.match_confidence DESC
    LIMIT 1;
  END IF;

  -- If no exact match, try fuzzy matching on client names
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      c.code,
      c.name,
      'fuzzy'::VARCHAR(20),
      similarity(c.name, client_name)::REAL,
      NULL::TEXT
    FROM clients c
    WHERE 
      c.active = TRUE
      AND similarity(c.name, client_name) >= similarity_threshold
    ORDER BY similarity(c.name, client_name) DESC
    LIMIT 1;
  END IF;

  -- If still no match, try fuzzy matching on aliases
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      c.code,
      c.name,
      'fuzzy'::VARCHAR(20),
      similarity(ca.alias, client_name)::REAL,
      ca.alias
    FROM client_aliases ca
    JOIN clients c ON ca.client_id = c.id
    WHERE 
      c.active = TRUE
      AND similarity(ca.alias, client_name) >= similarity_threshold
    ORDER BY similarity(ca.alias, client_name) DESC
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Product lookup function for CodeMatcher
CREATE OR REPLACE FUNCTION find_product_by_name_fuzzy(
  product_name TEXT,
  similarity_threshold REAL DEFAULT 0.9
)
RETURNS TABLE (
  product_code VARCHAR(100),
  product_name_canonical VARCHAR(255),
  match_type VARCHAR(20),
  confidence REAL,
  alias_used TEXT
) AS $$
BEGIN
  -- First try exact code match
  RETURN QUERY
  SELECT 
    p.code,
    p.name,
    'exact'::VARCHAR(20),
    1.0::REAL,
    NULL::TEXT
  FROM products p
  WHERE p.code = product_name AND p.active = TRUE
  LIMIT 1;

  -- If no exact code match, try exact alias match
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      p.code,
      p.name,
      'exact'::VARCHAR(20),
      pa.match_confidence::REAL,
      pa.alias
    FROM product_aliases pa
    JOIN products p ON pa.product_id = p.id
    WHERE pa.alias = product_name AND p.active = TRUE
    ORDER BY pa.match_confidence DESC
    LIMIT 1;
  END IF;

  -- If no exact match, try fuzzy matching on product names
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      p.code,
      p.name,
      'fuzzy'::VARCHAR(20),
      similarity(p.name, product_name)::REAL,
      NULL::TEXT
    FROM products p
    WHERE 
      p.active = TRUE
      AND similarity(p.name, product_name) >= similarity_threshold
    ORDER BY similarity(p.name, product_name) DESC
    LIMIT 1;
  END IF;

  -- If still no match, try fuzzy matching on aliases
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      p.code,
      p.name,
      'fuzzy'::VARCHAR(20),
      similarity(pa.alias, product_name)::REAL,
      pa.alias
    FROM product_aliases pa
    JOIN products p ON pa.product_id = p.id
    WHERE 
      p.active = TRUE
      AND similarity(pa.alias, product_name) >= similarity_threshold
    ORDER BY similarity(pa.alias, product_name) DESC
    LIMIT 1;
  END IF;
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
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_aliases ENABLE ROW LEVEL SECURITY;

-- Policies for service role (full access)
DROP POLICY IF EXISTS "service_role_all_pedidos" ON pedidos;
CREATE POLICY "service_role_all_pedidos" ON pedidos FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all_pedido_productos" ON pedido_productos;
CREATE POLICY "service_role_all_pedido_productos" ON pedido_productos FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all_processing_logs" ON processing_logs;
CREATE POLICY "service_role_all_processing_logs" ON processing_logs FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all_file_processing" ON file_processing_log;
CREATE POLICY "service_role_all_file_processing" ON file_processing_log FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all_clients" ON clients;
CREATE POLICY "service_role_all_clients" ON clients FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all_client_aliases" ON client_aliases;
CREATE POLICY "service_role_all_client_aliases" ON client_aliases FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all_products" ON products;
CREATE POLICY "service_role_all_products" ON products FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all_product_aliases" ON product_aliases;
CREATE POLICY "service_role_all_product_aliases" ON product_aliases FOR ALL USING (auth.role() = 'service_role');

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

-- Authenticated users can read canonical data
DROP POLICY IF EXISTS "authenticated_read_clients" ON clients;
CREATE POLICY "authenticated_read_clients" ON clients FOR SELECT USING (
  auth.role() = 'authenticated' AND active = TRUE
);

DROP POLICY IF EXISTS "authenticated_read_client_aliases" ON client_aliases;
CREATE POLICY "authenticated_read_client_aliases" ON client_aliases FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated_read_products" ON products;
CREATE POLICY "authenticated_read_products" ON products FOR SELECT USING (
  auth.role() = 'authenticated' AND active = TRUE
);

DROP POLICY IF EXISTS "authenticated_read_product_aliases" ON product_aliases;
CREATE POLICY "authenticated_read_product_aliases" ON product_aliases FOR SELECT USING (auth.role() = 'authenticated');

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
GRANT SELECT ON clients, client_aliases, products, product_aliases TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_stats TO authenticated;
GRANT EXECUTE ON FUNCTION search_orders_fuzzy TO authenticated;
GRANT EXECUTE ON FUNCTION find_client_by_name_fuzzy TO authenticated;
GRANT EXECUTE ON FUNCTION find_product_by_name_fuzzy TO authenticated;

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

-- Canonical data summary view
CREATE OR REPLACE VIEW canonical_data_summary AS
SELECT 
  'clients' as entity_type,
  COUNT(*) as total_canonical,
  COUNT(*) FILTER (WHERE active = TRUE) as active_canonical,
  (SELECT COUNT(*) FROM client_aliases) as total_aliases
FROM clients
UNION ALL
SELECT 
  'products' as entity_type,
  COUNT(*) as total_canonical,
  COUNT(*) FILTER (WHERE active = TRUE) as active_canonical,
  (SELECT COUNT(*) FROM product_aliases) as total_aliases
FROM products;

-- =============================================================================
-- SAMPLE DATA FOR TESTING (OPTIONAL)
-- =============================================================================

-- Insert some sample canonical clients
INSERT INTO clients (code, name, metadata) VALUES 
  ('SOUL_KITCHEN', 'SOUL Kitchen', '{"type": "restaurant", "region": "madrid"}'),
  ('ARROZ_CO', 'Arroz & Company', '{"type": "supplier", "category": "grains"}'),
  ('HUMMUS_PLUS', 'Hummus Plus', '{"type": "supplier", "category": "prepared_foods"}')
ON CONFLICT (code) DO NOTHING;

-- Insert some sample canonical products
INSERT INTO products (code, name, metadata) VALUES 
  ('ARROZ_JAZMIN', 'Arroz Jazmín', '{"category": "grains", "unit": "kg"}'),
  ('HUMMUS_CLASSIC', 'Hummus Clásico', '{"category": "prepared_foods", "unit": "kg"}'),
  ('ACEITE_OLIVA', 'Aceite de Oliva Virgen Extra', '{"category": "oils", "unit": "l"}')
ON CONFLICT (code) DO NOTHING;

-- Insert some sample aliases (these would be created automatically by CodeMatcher)
INSERT INTO client_aliases (client_id, alias, match_confidence) VALUES 
  ((SELECT id FROM clients WHERE code = 'SOUL_KITCHEN'), 'Purchase Order from SOUL Kitchen', 0.95),
  ((SELECT id FROM clients WHERE code = 'SOUL_KITCHEN'), 'SOUL Kitchen Restaurant', 0.90),
  ((SELECT id FROM clients WHERE code = 'ARROZ_CO'), 'Arroz Company', 0.85)
ON CONFLICT (alias) DO NOTHING;

INSERT INTO product_aliases (product_id, alias, match_confidence) VALUES 
  ((SELECT id FROM products WHERE code = 'ARROZ_JAZMIN'), 'ARROZ JAZMIN', 1.0),
  ((SELECT id FROM products WHERE code = 'ARROZ_JAZMIN'), 'Arroz Basmati', 0.80),
  ((SELECT id FROM products WHERE code = 'HUMMUS_CLASSIC'), 'HUMMUS', 0.95)
ON CONFLICT (alias) DO NOTHING;

-- =============================================================================
-- FINAL OPTIMIZATIONS
-- =============================================================================

-- Analyze tables for better query planning
ANALYZE pedidos;
ANALYZE pedido_productos;
ANALYZE processing_logs;
ANALYZE file_processing_log;
ANALYZE clients;
ANALYZE client_aliases;
ANALYZE products;
ANALYZE product_aliases;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Leo Orders - Complete Production Schema Deployed Successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '🏗️  Core Schema Features:';
  RAISE NOTICE '  - Orders: pedidos, pedido_productos, processing_logs, file_processing_log';
  RAISE NOTICE '  - Performance indexes optimized for 400+ orders/month';
  RAISE NOTICE '  - Row Level Security policies configured';
  RAISE NOTICE '  - Database functions for statistics and search';
  RAISE NOTICE '';
  RAISE NOTICE '🧠 Hybrid Code Matching System:';
  RAISE NOTICE '  - Canonical clients and products tables';
  RAISE NOTICE '  - Fuzzy alias matching with confidence scoring';
  RAISE NOTICE '  - Automated lookup functions for CodeMatcher';
  RAISE NOTICE '  - Sample data inserted for testing';
  RAISE NOTICE '';
  RAISE NOTICE '⚡ Performance Optimizations:';
  RAISE NOTICE '  - Trigram fuzzy search indexes';
  RAISE NOTICE '  - Composite indexes for date/channel queries';
  RAISE NOTICE '  - JSONB indexes for metadata searches';
  RAISE NOTICE '  - Processing duration auto-calculation';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Next Steps:';
  RAISE NOTICE '  1. Update your .env file with the new Supabase credentials';
  RAISE NOTICE '  2. Test the connection with your Node.js application';
  RAISE NOTICE '  3. Run a sample order processing to verify everything works';
  RAISE NOTICE '  4. Monitor performance with the built-in dashboard views';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Database Statistics:';
  RAISE NOTICE '  - Clients: %', (SELECT COUNT(*) FROM clients);
  RAISE NOTICE '  - Products: %', (SELECT COUNT(*) FROM products);
  RAISE NOTICE '  - Total aliases: %', (SELECT COUNT(*) FROM client_aliases) + (SELECT COUNT(*) FROM product_aliases);
END;
$$;