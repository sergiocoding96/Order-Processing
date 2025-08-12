# Leo Orders - Supabase Project Setup Guide

Since the Supabase MCP connection is currently unavailable, here's a step-by-step guide to manually create your new Supabase project with the complete schema.

## Step 1: Create New Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in the details:
   - **Name**: `Leo_orders`
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: `Europe West (Ireland)` - eu-west-1
   - **Organization**: Select your organization
4. Click "Create new project"
5. Wait for the project to initialize (2-3 minutes)

## Step 2: Deploy the Complete Schema

1. Once your project is ready, go to the **SQL Editor** in your Supabase dashboard
2. Click "New query"
3. Copy the entire contents of `/Users/sergiopalacio/Projects/Order Processing/leo-orders-complete-schema.sql`
4. Paste it into the SQL editor
5. Click "Run" to execute the complete schema
6. You should see success messages confirming the deployment

## Step 3: Get Your New Credentials

After the project is created, go to **Settings > API** in your Supabase dashboard:

```env
# Add these to your .env file
SUPABASE_URL=https://[your-project-ref].supabase.co
SUPABASE_ANON_KEY=eyJ... (starts with eyJ)
SUPABASE_SERVICE_KEY=eyJ... (starts with eyJ, longer than anon key)
```

## Step 4: Update Your Environment

1. Back up your current `.env` file:
   ```bash
   cp .env .env.backup
   ```

2. Update your `.env` file with the new credentials from Step 3

3. Test the connection:
   ```bash
   node -e "
   const { createClient } = require('@supabase/supabase-js');
   const supabase = createClient(
     process.env.SUPABASE_URL, 
     process.env.SUPABASE_SERVICE_KEY
   );
   supabase.from('pedidos').select('count', { count: 'exact' }).then(console.log);
   "
   ```

## Step 5: Verify the Complete Schema

Run these test queries in the Supabase SQL editor to verify everything deployed correctly:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Should show: client_aliases, clients, file_processing_log, pedido_productos, pedidos, product_aliases, products, processing_logs

-- Test the hybrid code matching functions
SELECT * FROM find_client_by_name_fuzzy('SOUL Kitchen');
SELECT * FROM find_product_by_name_fuzzy('HUMMUS');

-- Check sample data was inserted
SELECT c.code, c.name, COUNT(ca.id) as aliases_count
FROM clients c
LEFT JOIN client_aliases ca ON c.id = ca.client_id
GROUP BY c.id, c.code, c.name;
```

## What's Included in the Complete Schema

### ✅ Core Order Processing Tables
- `pedidos` - Main orders table with enrichment fields
- `pedido_productos` - Order line items with canonical codes
- `processing_logs` - System monitoring and debugging
- `file_processing_log` - File deduplication and tracking

### ✅ Hybrid Code Matching System
- `clients` - Canonical client registry
- `client_aliases` - Client fuzzy matching aliases
- `products` - Canonical product registry  
- `product_aliases` - Product fuzzy matching aliases

### ✅ Performance Optimizations
- 20+ specialized indexes for your query patterns
- Trigram fuzzy search support
- Composite indexes for date/channel queries
- JSONB indexes for metadata searches

### ✅ Advanced Functions
- `get_order_stats()` - Comprehensive order statistics
- `search_orders_fuzzy()` - Intelligent order search
- `find_client_by_name_fuzzy()` - Client lookup for CodeMatcher
- `find_product_by_name_fuzzy()` - Product lookup for CodeMatcher
- `cleanup_old_data()` - Automated maintenance

### ✅ Security Features
- Row Level Security (RLS) on all tables
- Service role policies for your application
- Read-only policies for authenticated users
- Secure access to canonical data

### ✅ Sample Data for Testing
- 3 canonical clients (including SOUL Kitchen)
- 3 canonical products (including Arroz Jazmín, Hummus)
- Aliases for fuzzy matching testing

## Testing Your Setup

After deployment, test with a sample order:

```javascript
// Test in your Node.js application
const testOrder = {
  numero_pedido: "TEST-001",
  cliente: "SOUL Kitchen Restaurant", // This should match via alias
  fecha_pedido: "2025-08-11",
  canal_origen: "telegram",
  total_pedido: 117.88,
  productos: [
    {
      nombre_producto: "ARROZ JAZMIN", // Should match canonical
      cantidad: 10,
      unidad: "Kilogramo", 
      precio_unitario: 2.798,
      total_producto: 27.98
    }
  ]
};

// Your existing PedidosModel.create() should now:
// 1. Store the order normally
// 2. Detect client via alias matching
// 3. Enrich with canonical codes
// 4. Track processing performance
```

## Performance Monitoring

Use these queries to monitor your system:

```sql
-- Check processing performance
SELECT * FROM performance_monitoring 
WHERE hour >= NOW() - INTERVAL '24 hours';

-- Get comprehensive stats  
SELECT * FROM get_order_stats();

-- Check canonical matching effectiveness
SELECT 
  COUNT(*) as total_orders,
  COUNT(*) FILTER (WHERE cliente_codigo_canon IS NOT NULL) as with_canonical_client,
  COUNT(*) FILTER (WHERE codigo_canon IS NOT NULL) as products_with_canonical
FROM pedidos p
LEFT JOIN pedido_productos pp ON p.id = pp.pedido_id;
```

## Troubleshooting

### Connection Issues
- Verify SUPABASE_URL and SUPABASE_SERVICE_KEY are correct
- Check that you're using the service key (not anon key) for write operations
- Ensure your IP is allowed in Supabase settings

### RLS Issues
- Your application should use the service role key for all operations
- The service role bypasses RLS automatically
- Only use anon/authenticated keys for read-only dashboard access

### Performance Issues
- Run `ANALYZE` on tables if queries are slow
- Check index usage with `EXPLAIN (ANALYZE, BUFFERS)`
- Monitor with the built-in performance views

Your Leo Orders project is now ready with a production-grade database that can handle 400+ orders/month with <10 second processing times and intelligent code matching!