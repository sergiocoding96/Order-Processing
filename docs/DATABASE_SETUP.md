# Database Setup Guide - Order Processing System

## Overview

This system uses **Supabase** (PostgreSQL) as the primary database with fallback to local JSON files for development. The database is optimized for handling 400+ orders per month with sub-10 second processing times.

## Quick Start

1. **Run the setup script:**
   ```bash
   npm run db:setup
   ```

2. **Execute the schema in Supabase dashboard**
3. **Verify the setup:**
   ```bash
   npm run db:health
   ```

## Detailed Setup Instructions

### 1. Environment Configuration

Ensure these variables are set in your `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

### 2. Database Schema Creation

**Option A: Using Supabase Dashboard (Recommended)**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the contents of `src/config/schema.sql` 
5. Execute the query

**Option B: Using Migration Script**

```bash
# This will display the schema and validate your setup
npm run db:setup
```

### 3. Schema Components

#### Tables Created:

- **`processing_logs`** - System logs and debugging information
- **`pedidos`** - Main orders table with customer and order details  
- **`pedido_productos`** - Order line items with product details

#### Indexes for Performance:

- Date-based queries (`fecha_pedido`)
- Channel filtering (`canal_origen`) 
- Status tracking (`estado`)
- Customer lookups (`cliente`)
- Product searches (`nombre_producto`)
- Composite indexes for complex queries

#### Custom Functions:

- **`get_order_stats()`** - Optimized statistics calculation
- **`cleanup_old_processing_logs()`** - Automated log maintenance
- **`update_updated_at_column()`** - Automatic timestamp updates

#### Security (Row Level Security):

- Service role has full access
- Authenticated users have read-only access
- All tables protected with RLS policies

## Database Architecture

### Performance Optimizations

1. **Indexed Queries**: All common query patterns are indexed
2. **Database Functions**: Complex statistics calculated server-side
3. **Connection Pooling**: Supabase handles connection management
4. **Prepared Statements**: All queries use parameterized statements

### Scaling Strategy

- **Vertical Scaling**: Supabase Pro plans support higher workloads
- **Read Replicas**: Can be added for reporting queries  
- **Caching**: Application-level caching with Redis (future)
- **Archiving**: Automated cleanup of old processing logs

### Data Retention

- **Processing Logs**: Automatically cleaned after 30 days
- **Orders**: Retained indefinitely (business requirement)
- **Backups**: Supabase handles automated backups

## Usage Examples

### Basic Operations

```javascript
import { PedidosModel } from './src/models/pedidos.js';

// Create order with products
const order = await PedidosModel.createWithProducts(orderData, products);

// Search orders
const results = await PedidosModel.searchOrders('ARROZ', {
  canal_origen: 'outlook',
  limit: 20
});

// Get statistics  
const stats = await PedidosModel.getStats({
  fecha_desde: '2024-01-01',
  fecha_hasta: '2024-12-31'
});
```

### Logging

```javascript
import { LogsModel } from './src/models/logs.js';

// Write system logs
await LogsModel.write('info', 'Order processed successfully', {
  source: 'ai-processor',
  order_id: 123,
  processing_time_ms: 850
});

// Get error statistics
const errorStats = await LogsModel.getErrorStats(24);
```

## Maintenance

### Regular Maintenance

Run the maintenance script weekly:

```bash
npm run db:maintenance
```

This performs:
- Log cleanup (removes logs older than 30 days)
- Statistics updates
- Performance analysis
- Error reporting

### Health Checks

Check database health:

```bash
npm run db:health
```

### Manual Operations

```bash
# Export database to JSON (development)
npm run db:maintenance -- --export

# Check specific table status
npm run db:health
```

## Monitoring

### Key Metrics to Monitor

1. **Order Processing Time**: Should be <10 seconds
2. **Database Response Time**: Should be <2 seconds
3. **Error Rate**: Should be <1% of total operations
4. **Database Size**: Monitor growth patterns
5. **Connection Usage**: Avoid connection limits

### Error Monitoring

The system automatically logs all errors to the `processing_logs` table:

```sql
SELECT level, source, message, created_at 
FROM processing_logs 
WHERE level = 'error' 
AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check environment variables
   - Verify Supabase project is active
   - Check network connectivity

2. **RLS Policy Errors**
   - Ensure you're using `supabaseAdmin` for write operations
   - Verify policies are created correctly

3. **Performance Issues**
   - Check if indexes are created
   - Review query patterns
   - Run `ANALYZE` on tables

4. **Schema Errors**
   - Verify all tables exist
   - Check for missing columns
   - Ensure functions are created

### Getting Help

1. Run the health check: `npm run db:health`
2. Check application logs: `tail -f logs/combined.log`
3. Review Supabase dashboard logs
4. Use the maintenance script for detailed analysis

## Migration from Local Database

If you have existing data in JSON files:

1. **Export existing data:**
   ```javascript
   // Your existing data in data/pedidos.json
   const existingData = JSON.parse(fs.readFileSync('data/pedidos.json'));
   ```

2. **Import to Supabase:**
   ```javascript
   for (const order of existingData) {
     await PedidosModel.create(order);
   }
   ```

3. **Verify migration:**
   ```bash
   npm run db:health
   ```

## Production Deployment

### Pre-deployment Checklist

- [ ] Environment variables configured
- [ ] Database schema deployed
- [ ] RLS policies enabled
- [ ] Indexes created
- [ ] Functions deployed
- [ ] Health check passes
- [ ] Maintenance script scheduled

### Performance Targets

- **Order Creation**: < 2 seconds
- **Order Search**: < 1 second  
- **Statistics**: < 3 seconds
- **Bulk Operations**: < 30 seconds (100 orders)
- **Database Health Check**: < 5 seconds

### Security Checklist

- [ ] RLS enabled on all tables
- [ ] Service role key secured
- [ ] Anonymous key restricted
- [ ] Database firewall configured (if using static IP)
- [ ] Backup retention configured
- [ ] Monitoring alerts set up