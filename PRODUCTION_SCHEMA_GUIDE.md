# Production Schema Guide - Pedidos Automation System

## Overview

This production-ready schema is optimized for your specific requirements:
- **Scale**: 400 orders/month (scalable to much higher volumes)
- **Performance**: <10 second processing time per order
- **Accuracy**: >95% data extraction accuracy
- **Security**: Enterprise-grade Row Level Security (RLS)

## Key Enhancements Over Basic Schema

### 1. Performance Optimizations

#### Specialized Indexes
- **Composite indexes** for common query patterns (date + channel, status + created_at)
- **GIN indexes** with trigram support for fuzzy text search on client names and products
- **Partial indexes** to exclude soft-deleted records, improving query performance
- **BTREE-GIN indexes** for efficient JSONB metadata queries

#### Query Performance Features
- **Materialized views** for dashboard queries
- **Database functions** that run server-side for complex aggregations
- **Optimized statistics function** with performance metrics tracking
- **Fuzzy search function** using PostgreSQL's similarity algorithms

### 2. Enhanced Data Model

#### Extended Order Tracking
```sql
-- Processing performance monitoring
processing_started_at TIMESTAMP WITH TIME ZONE,
processing_completed_at TIMESTAMP WITH TIME ZONE,
processing_duration_ms INTEGER, -- Automated calculation via triggers

-- AI model tracking
ai_model_used VARCHAR(50), -- Track which model processed each order
source_file_hash TEXT, -- Prevent duplicate processing
```

#### Canonical Code Enrichment
```sql
-- Client matching
cliente_codigo_canon VARCHAR(50),
cliente_match_status VARCHAR(20), -- 'exact', 'fuzzy', 'new', 'manual'
cliente_match_confidence DECIMAL(3,2),

-- Product matching  
codigo_canon VARCHAR(50),
product_match_status VARCHAR(20),
product_match_confidence DECIMAL(3,2),
categoria VARCHAR(100), -- Product categorization
```

#### File Processing Tracking
- Prevents duplicate processing via SHA-256 file hashing
- Tracks AI models used and processing performance
- Retry logic support with error tracking

### 3. Security Implementation

#### Row Level Security (RLS)
All tables have RLS enabled with granular policies:

```sql
-- Service role: Full access for your application
CREATE POLICY "service_role_all_pedidos" ON pedidos FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users: Read-only access to non-deleted records
CREATE POLICY "authenticated_read_pedidos" ON pedidos FOR SELECT USING (
  auth.role() = 'authenticated' AND deleted_at IS NULL
);
```

#### Data Protection Features
- **Soft delete support** with `deleted_at` fields
- **Audit trails** with created_by/updated_by tracking
- **IP address logging** for security monitoring
- **Request ID tracking** for distributed tracing

## Performance Benchmarks

### Expected Performance Metrics
Based on your requirements and the optimized schema:

| Metric | Target | Schema Optimization |
|--------|--------|-------------------|
| Order processing | <10 seconds | Indexed lookups, efficient inserts |
| Query response | <2 seconds | Composite indexes, views |
| Excel generation | <5 seconds | Optimized aggregation functions |
| Fuzzy search | <1 second | GIN trigram indexes |

### Index Strategy
```sql
-- Most critical for your use case
idx_pedidos_fecha_canal          -- Date range + channel queries
idx_pedidos_cliente_text         -- Fuzzy client search  
idx_pedidos_source_hash          -- Duplicate prevention
idx_pedido_productos_pedido_id   -- Order details lookup
```

## Database Functions Reference

### 1. Enhanced Statistics (`get_order_stats`)
```sql
SELECT * FROM get_order_stats(
  start_date := '2025-01-01',
  end_date := '2025-12-31',
  canal_filter := 'telegram'
);
```

Returns comprehensive metrics including:
- Order counts and amounts
- Average processing time
- Performance metrics (orders under 10s target)
- Top clients analysis
- Channel and status breakdowns

### 2. Fuzzy Search (`search_orders_fuzzy`)
```sql
SELECT * FROM search_orders_fuzzy(
  search_term := 'SOUL Kitchen',
  similarity_threshold := 0.3,
  max_results := 20
);
```

Uses PostgreSQL's similarity algorithms for intelligent search across:
- Client names
- Order numbers  
- Observations

### 3. Maintenance (`cleanup_old_data`)
```sql
SELECT * FROM cleanup_old_data(
  log_retention_days := 30,
  processing_log_retention_days := 90
);
```

Automated cleanup while preserving important data:
- Keeps error logs longer than info logs
- Preserves failed processing attempts for debugging
- Returns counts of cleaned records

## Useful Views

### 1. Complete Orders (`orders_complete`)
```sql
SELECT * FROM orders_complete 
WHERE fecha_pedido >= '2025-08-01'
ORDER BY created_at DESC;
```

Pre-joined view with all order products as JSON array.

### 2. Recent Orders Dashboard (`recent_orders`)
```sql
SELECT * FROM recent_orders 
LIMIT 20;
```

Optimized for dashboard displays with product counts.

### 3. Performance Monitoring (`performance_monitoring`)
```sql
SELECT * FROM performance_monitoring
WHERE hour >= NOW() - INTERVAL '24 hours';
```

Hourly performance metrics for system monitoring.

## Migration from Current Schema

Your existing code in `src/models/pedidos.js` will work seamlessly with these enhancements because:

1. **Backward compatibility**: All existing columns are preserved
2. **Additive changes**: New columns have sensible defaults
3. **Enhanced functionality**: Existing methods gain performance benefits

### Optional Model Enhancements
You can enhance your model to use new features:

```javascript
// In PedidosModel.create()
static async create(orderData) {
  const enhancedData = {
    ...orderData,
    processing_started_at: new Date(),
    source_file_hash: orderData.fileHash, // if available
    ai_model_used: orderData.aiModel // track which model processed this
  };
  
  // ... existing logic
}
```

## Monitoring and Maintenance

### Daily Monitoring Queries
```sql
-- Check processing performance
SELECT 
  DATE(created_at) as date,
  AVG(processing_duration_ms) as avg_time,
  COUNT(*) FILTER (WHERE processing_duration_ms > 10000) as slow_orders
FROM pedidos 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at);

-- Check error rates
SELECT level, COUNT(*) 
FROM processing_logs 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY level;
```

### Weekly Maintenance
```sql
-- Run cleanup
SELECT cleanup_old_data(30, 90);

-- Update table statistics  
ANALYZE pedidos;
ANALYZE pedido_productos;
```

## Cost Optimization

### Supabase Pricing Considerations
- **Database size**: Indexed efficiently to minimize storage costs
- **Query optimization**: Reduces compute usage
- **Automatic cleanup**: Prevents unbounded growth
- **Read replicas**: Schema supports read-only replicas for reporting

### Scaling Strategy
1. **Phase 1** (current): Single database, optimized indexes
2. **Phase 2** (>1000 orders/month): Read replicas for reporting
3. **Phase 3** (>5000 orders/month): Partitioning by date ranges
4. **Phase 4** (>10000 orders/month): Microservices with event sourcing

## Security Best Practices

### Environment Variables Required
```bash
# Your existing variables work as-is
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key  
SUPABASE_SERVICE_KEY=your_service_key # Critical for RLS bypass
```

### RLS Policy Testing
```sql
-- Test as service role (should see all records)
SET ROLE service_role;
SELECT COUNT(*) FROM pedidos;

-- Test as authenticated user (should see only non-deleted)
SET ROLE authenticated;
SELECT COUNT(*) FROM pedidos WHERE deleted_at IS NULL;
```

## Troubleshooting

### Common Issues

1. **Slow queries**: Check if indexes are being used
```sql
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM pedidos WHERE fecha_pedido >= '2025-08-01';
```

2. **RLS blocking queries**: Ensure using `supabaseAdmin` for writes
3. **Duplicate key errors**: Check `numero_pedido` uniqueness handling
4. **Processing timeouts**: Monitor `processing_duration_ms` metrics

### Performance Monitoring
```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
FROM pg_stat_user_indexes 
ORDER BY idx_tup_read DESC;

-- Check slow queries (if pg_stat_statements enabled)
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

This schema is production-ready and will scale well beyond your current needs while maintaining optimal performance for your 400 orders/month requirement.