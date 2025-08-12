# Complete Render Deployment Guide
# Leo Order Processing System - FREE Tier Optimized

## Overview
This guide provides step-by-step instructions for deploying the Leo Order Processing System to Render's free tier (750 hours/month) with webhook reliability optimizations.

## Prerequisites

### 1. Required Accounts & Services
- **GitHub Account**: For repository hosting
- **Render Account**: Sign up at render.com (free)
- **Supabase Project**: Database (completed in setup)
- **API Keys**: OpenAI, Gemini, Telegram Bot

### 2. Repository Setup
Ensure your repository is pushed to GitHub:
```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

## Phase 1: Pre-Deployment Preparation

### Step 1: Environment Configuration
1. **Copy production template**:
   ```bash
   cp .env.production.template .env.production
   ```

2. **Fill in your production values**:
   ```env
   # Database (from Supabase dashboard)
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_KEY=your-service-key
   
   # AI APIs
   OPENAI_API_KEY=sk-your-openai-key
   GEMINI_API_KEY=your-gemini-key
   
   # Telegram
   TELEGRAM_BOT_TOKEN=your-bot-token
   
   # Business Config
   LEOS_FOODS_CIF=your-cif-number
   ```

### Step 2: Final Testing
Run local production test:
```bash
npm run start:production
curl http://localhost:3000/health
```

## Phase 2: Render Service Creation

### Step 1: Create Web Service
1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Click "New" → "Web Service"**
3. **Connect Repository**:
   - Select your GitHub repository
   - Choose "order-processing" (or your repo name)
   - Branch: `main`

### Step 2: Configure Service Settings
**Basic Settings**:
- **Name**: `leo-orders-api`
- **Region**: `Frankfurt (Europe)` 
- **Branch**: `main`
- **Runtime**: `Node`
- **Build Command**: `npm run render:build`
- **Start Command**: `npm run render:start`

**Advanced Settings**:
- **Plan**: `Free` (750 hours/month)
- **Auto-Deploy**: `Yes`
- **Health Check Path**: `/health`

### Step 3: Environment Variables
In Render Dashboard, add these environment variables:

**Public Variables** (can be visible):
```
NODE_ENV=production
PORT=10000
LOG_LEVEL=info
WEBHOOK_BASE_URL=https://leo-orders-api.onrender.com
RENDER_FREE_TIER=true
AUTO_EXPORT_XLS=true
```

**Secret Variables** (encrypted):
```
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key  
SUPABASE_SERVICE_KEY=your-service-key
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key
TELEGRAM_BOT_TOKEN=your-bot-token
LEOS_FOODS_CIF=your-cif
```

## Phase 3: Deployment & Configuration

### Step 1: Initial Deployment
1. **Click "Create Web Service"**
2. **Monitor build logs** in Render dashboard
3. **Wait for successful deployment** (5-10 minutes)
4. **Note your service URL**: `https://leo-orders-api.onrender.com`

### Step 2: Update Webhook URLs
Update your service URL in:
1. **Telegram Bot Webhook**:
   ```bash
   curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook \
        -d url=https://leo-orders-api.onrender.com/webhook/telegram
   ```

2. **Environment Variable**:
   - Go to Render Dashboard
   - Update `WEBHOOK_BASE_URL` with your actual URL
   - Service will auto-redeploy

### Step 3: Verify Deployment
Check all endpoints:
```bash
# Health check
curl https://leo-orders-api.onrender.com/health

# Ping test  
curl https://leo-orders-api.onrender.com/ping

# Webhook test (should return 200)
curl -X POST https://leo-orders-api.onrender.com/webhook/telegram \
     -H "Content-Type: application/json" \
     -d '{"message": {"text": "test"}}'
```

## Phase 4: Production Optimization

### Step 1: Free Tier Sleep Prevention
Render free tier apps sleep after 15 minutes of inactivity. To prevent this:

1. **Use a monitoring service** (free options):
   - UptimeRobot (free plan: 50 monitors)
   - Pingdom (free plan: 1 monitor)
   - Better Stack (free plan)

2. **Configure monitor**:
   - URL: `https://leo-orders-api.onrender.com/ping`
   - Interval: 5 minutes
   - Method: GET

### Step 2: Database Performance
Optimize Supabase settings:
1. **Connection Pooling**: Already enabled in config
2. **Index Optimization**: Run in Supabase SQL Editor:
   ```sql
   -- Optimize query performance
   ANALYZE pedidos;
   ANALYZE pedido_productos;
   ```

### Step 3: Monitoring Setup
Add these monitoring endpoints:
```bash
# Memory usage
curl https://leo-orders-api.onrender.com/health

# Performance metrics
curl https://leo-orders-api.onrender.com/metrics
```

## Phase 5: Testing & Validation

### Step 1: End-to-End Testing
1. **Send test Telegram message**:
   - Message your bot with `/stats`
   - Should receive response within 5 seconds

2. **Test file processing**:
   - Send PDF to bot
   - Check processing logs in Render dashboard
   - Verify data in Supabase

3. **Test webhook processing**:
   - Send test webhook from external service
   - Monitor response times (should be <3 seconds)

### Step 2: Performance Validation
Monitor key metrics:
```bash
# Response time should be <2 seconds
time curl https://leo-orders-api.onrender.com/health

# Memory usage should be <400MB
curl -s https://leo-orders-api.onrender.com/health | jq '.memory'

# Database connectivity
curl -s https://leo-orders-api.onrender.com/health | jq '.services.database'
```

## Free Tier Optimization Tips

### Resource Management
- **Memory Limit**: 512MB (monitor usage)
- **CPU**: Shared (0.1 CPU units)
- **Build Time**: 10 minutes max
- **Sleep**: After 15 minutes inactivity

### Cost Control Strategies
1. **AI API Usage**:
   - Use Gemini 2.0 Flash (cheaper) for JSON processing
   - GPT-4o only for image analysis
   - DeepSeek as fallback (much cheaper)

2. **Database Optimization**:
   - Connection pooling enabled
   - Query result caching
   - Index optimization

3. **File Processing**:
   - 10MB file size limit
   - Temporary storage cleanup
   - Compressed logging

### Monitoring Free Tier Usage
Track your usage:
1. **Render Dashboard**: Monitor hours used (750/month limit)
2. **Supabase Dashboard**: Database usage (500MB limit)
3. **AI API Usage**: OpenAI/Google billing dashboards

## Troubleshooting

### Common Issues

**1. Service Won't Start**
```bash
# Check build logs in Render dashboard
# Common causes:
# - Missing environment variables
# - Build command errors
# - Node version mismatch
```

**2. Database Connection Failed**
```bash
# Verify Supabase credentials
# Check network connectivity
# Confirm RLS policies are correct
```

**3. Webhook Timeouts**
```bash
# Check processing time optimization
# Verify file size limits
# Monitor memory usage
```

**4. AI API Errors**
```bash
# Check API key validity
# Monitor rate limits
# Verify fallback configuration
```

### Support Resources
- **Render Support**: Via dashboard help button
- **Supabase Support**: Via support tickets
- **Project Logs**: Render dashboard → Service → Logs

## Success Metrics
After deployment, verify:
- ✅ Health check responds <2 seconds
- ✅ Database queries <1 second
- ✅ File processing <10 seconds
- ✅ Memory usage <400MB
- ✅ 99% uptime with monitoring
- ✅ All webhooks functional

## Next Steps
1. **Set up monitoring service** for sleep prevention
2. **Configure backup strategy** for critical data
3. **Plan upgrade path** if usage exceeds free tier
4. **Document operational procedures** for maintenance

---

**Deployment Complete! 🚀**

Your Leo Order Processing System is now running on Render's free tier with optimized webhook reliability and performance monitoring.

**Service URL**: https://leo-orders-api.onrender.com
**Health Check**: https://leo-orders-api.onrender.com/health
**Admin Panel**: https://dashboard.render.com