-- Pedidos Automation System Database Schema
-- Run this in your Supabase SQL Editor

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
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidos_canal ON pedidos(canal_origen);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_created_at ON pedidos(created_at);
CREATE INDEX IF NOT EXISTS idx_pedido_productos_pedido_id ON pedido_productos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_productos_nombre ON pedido_productos(nombre_producto);

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

-- Enable Row Level Security (RLS) for production
-- ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE pedido_productos ENABLE ROW LEVEL SECURITY;

-- Create policies (uncomment for production)
-- CREATE POLICY "Enable all operations for service role" ON pedidos FOR ALL USING (true);
-- CREATE POLICY "Enable all operations for service role" ON pedido_productos FOR ALL USING (true);