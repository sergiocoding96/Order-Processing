# Leo Order Processing System - Render Deployment Guide (FREE TIER)

## Overview
Complete deployment guide for Leo Order Processing System on Render's **FREE tier**. The free tier provides:
- **750 hours/month** (perfect for 24/7 operation - 744 hours in 31-day month)
- **512MB memory**
- **European region available** (Frankfurt)
- **Automatic HTTPS**
- **Service sleeps after 15 minutes** of inactivity
- **10-30 second cold start** times
- **Ephemeral storage** (use /tmp for files)

## Prerequisites

### 1. Supabase Database Setup
Ensure your Supabase project is configured and running:
- Database tables created (pedidos, pedido_productos, processing_logs)
- Row Level Security (RLS) policies configured
- Service role key available

### 2. API Keys Ready
- OpenAI API Key (GPT-4o for visual analysis)
- Google Gemini API Key (primary JSON processing)
- DeepSeek API Key (optional fallback)
- Telegram Bot Token (if using Telegram integration)

### 3. GitHub Repository
- Code pushed to GitHub repository
- Repository accessible to Render

## Step-by-Step Deployment

### Step 1: Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up using your GitHub account
3. Authorize Render to access your repositories

### Step 2: Connect Repository
1. In Render Dashboard, click **"New +"**
2. Select **"Web Service"**
3. Choose **"Build and deploy from a Git repository"**
4. Connect your GitHub account and select your repository
5. Choose the correct branch (usually `main` or `master`)

### Step 3: Configure Service Settings
```
Service Name: leo-orders-api
Region: Frankfurt (Europe)
Branch: main
Runtime: Node
Build Command: npm run render:build
Start Command: npm run render:start
```

### Step 4: Environment Variables
In Render Dashboard > Environment, add these variables:

#### System Configuration
```bash
NODE_ENV=production
PORT=10000
LOG_LEVEL=info
```

#### Rate Limiting
```bash
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200
```

#### AI API Keys (⚠️ SENSITIVE)
```bash
OPENAI_API_KEY=your_openai_key_here
GEMINI_API_KEY=your_gemini_key_here
DEEPSEEK_API_KEY=your_deepseek_key_here
```

#### Supabase Database (⚠️ SENSITIVE)
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key
```

#### Telegram Integration (⚠️ SENSITIVE)
```bash
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

#### Application Configuration
```bash
LEOS_FOODS_CIF=your_company_cif
AUTO_EXPORT_XLS=true
XLS_OUTPUT_DIR=/tmp/reports
UPLOAD_DIR=/tmp/uploads
TEMP_DIR=/tmp/processing
```

#### Production Settings
```bash
WEBHOOK_BASE_URL=https://leo-orders-api.onrender.com
KEEP_ALIVE_TIMEOUT=30000
HEADERS_TIMEOUT=35000
```

> **Note**: Replace `leo-orders-api` with your actual service name

### Step 5: Configure Health Checks
Render will automatically use the `/health` endpoint. Our configuration includes:
- **Health Check Path**: `/health`
- **Check Interval**: 60 seconds
- **Timeout**: 10 seconds
- **Failure Threshold**: 3 consecutive failures

### Step 6: Deploy
1. Click **"Create Web Service"**
2. Render will automatically start the build process
3. Monitor the build logs in real-time
4. First deployment takes 5-10 minutes

### Step 7: Verify Deployment
1. **Health Check**: Visit `https://your-app.onrender.com/health`
2. **Ping Test**: Visit `https://your-app.onrender.com/ping`
3. **Check Logs**: Monitor logs in Render Dashboard

## Webhook Configuration

### Telegram Webhook
If using Telegram webhooks instead of polling:
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-app.onrender.com/webhook/telegram"}'
```

### Email Processing Webhook
Configure your email service to send webhooks to:
```
https://your-app.onrender.com/webhook/email
```

## Free Tier Considerations & Optimizations

### 1. Sleep/Wake Behavior
- **Sleep**: After 15 minutes of inactivity
- **Wake**: 10-30 seconds on first request
- **Solution**: Use uptime monitoring services (UptimeRobot, Better Uptime) to ping your service every 10 minutes

### 2. Memory Management
- **Limit**: 512MB RAM
- **Optimization**: Added `--max-old-space-size=512` to production start command
- **Monitoring**: Watch memory usage in logs

### 3. File Storage
- **Limitation**: No persistent storage
- **Solution**: All file operations use `/tmp` directory
- **Cleanup**: Files in `/tmp` are automatically cleaned up

### 4. Database Connections
- **Optimization**: Use Supabase connection pooling
- **Pool Size**: Limited to 3-5 concurrent connections for free tier

### 5. Processing Time Limits
- **Request Timeout**: 30 seconds maximum
- **Background Tasks**: Use Supabase Edge Functions for longer operations

## Monitoring & Maintenance

### Uptime Monitoring (Recommended)
Set up external monitoring to prevent sleeping:

1. **UptimeRobot** (Free):
   - Monitor: `https://your-app.onrender.com/ping`
   - Interval: 10 minutes

2. **Better Uptime**:
   - Monitor: `https://your-app.onrender.com/health`
   - Interval: 5 minutes

### Log Monitoring
1. **Render Logs**: Real-time in dashboard
2. **Application Logs**: Stored in database (`processing_logs` table)
3. **Error Tracking**: All errors logged to Supabase

### Performance Monitoring
```bash
# Add to your monitoring script
curl -s https://your-app.onrender.com/health | jq .
```

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check package.json scripts
npm run render:build  # Test locally
npm run render:start  # Test locally
```

#### Environment Variables Missing
- Double-check all required environment variables are set
- Use `.env.render` template as reference

#### Database Connection Issues
```bash
# Test database connection
curl https://your-app.onrender.com/health
```

#### Memory Issues
- Monitor logs for "out of memory" errors
- Optimize AI model usage
- Use streaming for large files

#### Webhook Timeouts
- Ensure processing completes within 30 seconds
- Move long operations to background queues

### Debug Commands
```bash
# Test health endpoint
curl https://your-app.onrender.com/health

# Test ping endpoint  
curl https://your-app.onrender.com/ping

# Test webhook (replace with actual data)
curl -X POST https://your-app.onrender.com/webhook/email \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

## Cost Analysis (FREE vs PAID)

### FREE Tier Benefits
- **Cost**: $0/month
- **Hours**: 750/month (perfect for our 400 orders/month)
- **Memory**: 512MB (sufficient for our workload)
- **HTTPS**: Included
- **Region**: Frankfurt available

### When to Upgrade
Consider paid tier if:
- Processing >1000 orders/month
- Need guaranteed uptime (no sleeping)
- Require >512MB memory
- Need persistent storage
- Processing very large files

## Security Checklist

- [ ] All sensitive environment variables are set in Render (not in code)
- [ ] Supabase RLS policies are enabled
- [ ] Rate limiting is configured
- [ ] HTTPS is enforced (automatic on Render)
- [ ] Webhook endpoints are secured
- [ ] API keys have minimum required permissions
- [ ] Database connection uses service role key
- [ ] File uploads are size-limited

## Success Metrics

After successful deployment, verify:
- [ ] Health checks pass consistently
- [ ] Webhook endpoints respond within 5 seconds
- [ ] Database operations complete successfully  
- [ ] AI processing works correctly
- [ ] Excel report generation functions
- [ ] Telegram bot responds (if configured)
- [ ] File uploads work properly
- [ ] Error logging is functioning

## Support & Resources

- **Render Documentation**: https://render.com/docs
- **Render Community**: https://community.render.com
- **Render Status**: https://status.render.com
- **Supabase Docs**: https://supabase.io/docs

## Next Steps After Deployment

1. **Configure uptime monitoring**
2. **Set up webhook endpoints in external services**
3. **Test complete order processing workflow**
4. **Monitor performance for first week**
5. **Optimize based on real-world usage patterns**

---

**🎉 Congratulations!** Your Leo Order Processing System is now running on Render's free tier, capable of handling 400+ orders per month with reliable webhook processing and AI-powered data extraction.