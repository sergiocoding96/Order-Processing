-- Pedidos Automation System Database Schema
-- Run this in your Supabase SQL Editor

-- Processing logs table (for system monitoring and debugging)
CREATE TABLE IF NOT EXISTS processing_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug')),
  message TEXT NOT NULL,
  source TEXT,
  context JSONB DEFAULT '{}'
);

-- Orders table
CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  numero_pedido VARCHAR(100),
  cliente VARCHAR(300),
  fecha_pedido DATE,
  canal_origen VARCHAR(20) CHECK (canal_origen IN ('outlook', 'telegram')),
  total_pedido DECIMAL(10,2),
  observaciones TEXT,
  estado VARCHAR(20) DEFAULT 'procesado' CHECK (estado IN ('procesado', 'error', 'pendiente')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order products table  
CREATE TABLE IF NOT EXISTS pedido_productos (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
  nombre_producto VARCHAR(300) NOT NULL,
  cantidad DECIMAL(8,2) NOT NULL,
  unidad VARCHAR(50),
  precio_unitario DECIMAL(10,2),
  total_producto DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
-- Processing logs indexes
CREATE INDEX IF NOT EXISTS idx_processing_logs_created_at ON processing_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_processing_logs_level ON processing_logs(level);
CREATE INDEX IF NOT EXISTS idx_processing_logs_source ON processing_logs(source);

-- Pedidos indexes  
CREATE INDEX IF NOT EXISTS idx_pedidos_numero ON pedidos(numero_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidos_canal ON pedidos(canal_origen);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_created_at ON pedidos(created_at);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente);

-- Pedido productos indexes
CREATE INDEX IF NOT EXISTS idx_pedido_productos_pedido_id ON pedido_productos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_productos_nombre ON pedido_productos(nombre_producto);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_canal ON pedidos(fecha_pedido, canal_origen);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado_fecha ON pedidos(estado, created_at);

-- Create updated_at trigger for pedidos
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_pedidos_updated_at 
    BEFORE UPDATE ON pedidos 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add data cleanup function for old logs (keeps last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_processing_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM processing_logs 
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Add function to get order statistics
CREATE OR REPLACE FUNCTION get_order_stats(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total_orders BIGINT,
  total_amount NUMERIC,
  avg_order_value NUMERIC,
  orders_by_channel JSONB,
  orders_by_status JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_orders AS (
    SELECT 
      canal_origen,
      estado,
      total_pedido
    FROM pedidos
    WHERE 
      (start_date IS NULL OR fecha_pedido >= start_date) AND
      (end_date IS NULL OR fecha_pedido <= end_date)
  ),
  stats AS (
    SELECT 
      COUNT(*) as order_count,
      COALESCE(SUM(total_pedido), 0) as amount_sum,
      CASE 
        WHEN COUNT(*) > 0 THEN COALESCE(SUM(total_pedido), 0) / COUNT(*)
        ELSE 0
      END as avg_value
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
  )
  SELECT 
    stats.order_count,
    stats.amount_sum,
    stats.avg_value,
    COALESCE(channel_stats.channel_json, '{}'::jsonb),
    COALESCE(status_stats.status_json, '{}'::jsonb)
  FROM stats
  CROSS JOIN channel_stats
  CROSS JOIN status_stats;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (RLS) for production
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access
CREATE POLICY "Enable all operations for service role" ON pedidos FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Enable all operations for service role" ON pedido_productos FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Enable all operations for service role" ON processing_logs FOR ALL USING (auth.role() = 'service_role');

-- Create policies for authenticated users (if you plan to add user authentication)
CREATE POLICY "Enable read for authenticated users" ON pedidos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read for authenticated users" ON pedido_productos FOR SELECT USING (auth.role() = 'authenticated');