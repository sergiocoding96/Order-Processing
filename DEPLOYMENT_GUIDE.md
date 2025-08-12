# Leo Order Processing - Production Deployment Guide

## Quick Start Deployment

### **1. Railway Setup (5 minutes)**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to existing project or create new
railway link  # If project exists
# OR
railway new pedidos-automation --template blank

# Switch to production environment
railway environment production
```

### **2. Environment Configuration**

```bash
# Required environment variables
railway variables set NODE_ENV=production
railway variables set PORT=3000

# Database (Supabase)
railway variables set SUPABASE_URL=https://your-project.supabase.co
railway variables set SUPABASE_ANON_KEY=your-anon-key-here
railway variables set SUPABASE_SERVICE_KEY=your-service-key-here

# AI Services
railway variables set OPENAI_API_KEY=your-openai-key
railway variables set GEMINI_API_KEY=your-gemini-key

# Communication
railway variables set TELEGRAM_BOT_TOKEN=your-telegram-token

# Auto-configure webhooks (will be set after first deployment)
railway variables set WEBHOOK_BASE_URL=https://your-app.up.railway.app
railway variables set TELEGRAM_WEBHOOK_URL=https://your-app.up.railway.app/webhook/telegram
railway variables set MAILHOOK_WEBHOOK_URL=https://your-app.up.railway.app/webhook/mailhook

# Security & Performance
railway variables set LOG_LEVEL=info
railway variables set RATE_LIMIT_WINDOW_MS=900000
railway variables set RATE_LIMIT_MAX_REQUESTS=100
```

### **3. Deploy Application**

```bash
# Run pre-deployment checks
npm test

# Deploy to Railway
railway up

# Get your deployment URL
railway domain

# Check deployment health
curl https://your-app.up.railway.app/health
```

### **4. Configure Webhooks**

```bash
# After deployment, get your Railway domain
RAILWAY_DOMAIN=$(railway domain)

# Update webhook URLs with actual domain
railway variables set WEBHOOK_BASE_URL=https://$RAILWAY_DOMAIN
railway variables set TELEGRAM_WEBHOOK_URL=https://$RAILWAY_DOMAIN/webhook/telegram
railway variables set MAILHOOK_WEBHOOK_URL=https://$RAILWAY_DOMAIN/webhook/mailhook

# Redeploy with updated webhook URLs
railway up
```

---

## Database Setup

### **Supabase Configuration**

1. **Create Supabase project**:
   - Go to [supabase.com](https://supabase.com)
   - Create new project (choose Frankfurt region for EU)
   - Note your project URL and keys

2. **Run database migrations**:
   ```bash
   # Set environment variables locally
   export SUPABASE_URL=your_url_here
   export SUPABASE_SERVICE_KEY=your_service_key_here
   
   # Run database setup
   npm run db:setup
   ```

3. **Verify database connection**:
   ```bash
   npm run db:health
   ```

---

## Telegram Bot Setup

### **1. Create Bot**

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Create new bot: `/newbot`
3. Set bot name and username
4. Copy the bot token

### **2. Configure Webhooks**

```bash
# Set bot token
railway variables set TELEGRAM_BOT_TOKEN=your_bot_token_here

# After deployment, set webhook
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-app.up.railway.app/webhook/telegram"}'

# Verify webhook
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

---

## Email Integration (Mailhook)

### **1. Configure Email Provider**

For Outlook/Office365:
```bash
# Set up Microsoft Graph API credentials
railway variables set MICROSOFT_CLIENT_ID=your_client_id
railway variables set MICROSOFT_CLIENT_SECRET=your_client_secret
railway variables set MICROSOFT_TENANT_ID=your_tenant_id
```

### **2. Set Webhook URL**

Configure your email provider to send webhooks to:
```
https://your-app.up.railway.app/webhook/mailhook
```

---

## Monitoring & Maintenance

### **Health Monitoring**

```bash
# Check application health
curl https://your-app.up.railway.app/health

# Check detailed metrics  
curl https://your-app.up.railway.app/health/detailed

# View application logs
railway logs
```

### **Database Maintenance**

```bash
# Check database status
npm run db:health

# Export data backup
npm run db:export

# Run maintenance tasks
npm run db:maintenance
```

---

## Deployment Verification Checklist

- [ ] ✅ Application starts without errors
- [ ] ✅ Health endpoint returns 200
- [ ] ✅ Database connection successful
- [ ] ✅ Telegram bot responds to `/start`
- [ ] ✅ Webhook endpoints accessible
- [ ] ✅ File upload functionality works
- [ ] ✅ AI processing pipeline functional
- [ ] ✅ Excel report generation works
- [ ] ✅ Error logging operational
- [ ] ✅ Rate limiting configured
- [ ] ✅ Environment variables secured

---

## Troubleshooting

### **Common Issues**

1. **Deployment fails**:
   ```bash
   railway logs --tail
   # Check for missing environment variables or build errors
   ```

2. **Database connection issues**:
   ```bash
   # Verify Supabase credentials
   npm run db:health
   ```

3. **Telegram webhook not working**:
   ```bash
   # Check webhook status
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   
   # Reset webhook
   curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
   ```

4. **AI processing errors**:
   ```bash
   # Check API key validity and quotas
   railway logs --filter "AI processing"
   ```

### **Support Resources**

- Railway documentation: [docs.railway.app](https://docs.railway.app)
- Railway logs: `railway logs`
- Supabase dashboard: [app.supabase.com](https://app.supabase.com)
- Application health: `https://your-app.up.railway.app/health`

---

## CI/CD Pipeline (Optional)

For automated deployments, set up GitHub Actions:

1. **Add Railway token to GitHub secrets**:
   - Go to your repository settings
   - Add `RAILWAY_TOKEN` secret
   - Get token from: `railway login --token`

2. **Push to main branch triggers deployment**:
   - Tests run automatically
   - Deployment happens on test success
   - Health check verifies deployment

---

## Cost Monitoring

Monitor your deployment costs:

```bash
# Check Railway usage
railway status

# Monitor API usage
# - OpenAI: platform.openai.com/usage
# - Supabase: app.supabase.com usage tab
```

**Expected monthly cost**: ~$36 for 400 orders/month ($0.09/order)