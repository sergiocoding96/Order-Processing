# Render Deployment Checklist
## Leo Order Processing System - Production Ready ✅

### Pre-Deployment Verification

#### ✅ Code & Configuration
- [ ] All code committed to GitHub repository
- [ ] `render.yaml` configured with correct settings
- [ ] Environment variables template ready (`.env.render.template`)
- [ ] Keep-alive service integrated for free tier
- [ ] Health checks optimized for webhook reliability
- [ ] Production logging configured

#### ✅ Dependencies & Build
- [ ] `package.json` production scripts configured
- [ ] All dependencies listed in package.json
- [ ] Node.js version specified (>=18.0.0)
- [ ] Build command tested locally: `npm run render:build`
- [ ] Start command tested locally: `npm run render:start`

#### ✅ API Keys & Credentials Ready
- [ ] Supabase URL, anon key, service key
- [ ] OpenAI API key (for image analysis)
- [ ] Gemini API key (for JSON processing)  
- [ ] Telegram bot token
- [ ] Company CIF number
- [ ] Optional: Anthropic API key, DeepSeek API key

### Deployment Steps

#### Phase 1: Render Service Setup
- [ ] **1.1** Go to https://dashboard.render.com
- [ ] **1.2** Click "New" → "Web Service"
- [ ] **1.3** Connect GitHub repository
- [ ] **1.4** Select repository and branch (main)
- [ ] **1.5** Configure service settings:
  ```
  Name: leo-orders-api
  Region: Frankfurt
  Branch: main
  Runtime: Node
  Build Command: npm run render:build
  Start Command: npm run render:start
  Plan: Free
  Auto-Deploy: Yes
  ```

#### Phase 2: Environment Configuration
- [ ] **2.1** Add public environment variables:
  ```
  NODE_ENV=production
  PORT=10000
  RENDER_FREE_TIER=true
  LOG_LEVEL=info
  WEBHOOK_BASE_URL=https://leo-orders-api.onrender.com
  AUTO_EXPORT_XLS=true
  ```

- [ ] **2.2** Add sensitive environment variables (as secrets):
  ```
  SUPABASE_URL=your-supabase-url
  SUPABASE_ANON_KEY=your-anon-key
  SUPABASE_SERVICE_KEY=your-service-key
  OPENAI_API_KEY=your-openai-key
  GEMINI_API_KEY=your-gemini-key
  TELEGRAM_BOT_TOKEN=your-bot-token
  LEOS_FOODS_CIF=your-cif
  ```

#### Phase 3: Deployment & Testing
- [ ] **3.1** Click "Create Web Service"
- [ ] **3.2** Monitor build logs for successful completion
- [ ] **3.3** Verify service URL (update WEBHOOK_BASE_URL if different)
- [ ] **3.4** Test endpoints:
  - [ ] `GET /health` - Should return 200 with database connected
  - [ ] `GET /ping` - Should return pong with timestamp  
  - [ ] `GET /metrics` - Should return detailed metrics
  - [ ] `POST /webhook/telegram` - Should accept webhook calls

#### Phase 4: Webhook Configuration
- [ ] **4.1** Update Telegram webhook URL:
  ```bash
  curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook \
       -d url=https://your-actual-service-url.onrender.com/webhook/telegram
  ```
- [ ] **4.2** Test Telegram bot responds to commands
- [ ] **4.3** Test file upload processing
- [ ] **4.4** Verify database writes working

### Post-Deployment Setup

#### Phase 5: Monitoring & Keep-Alive
- [ ] **5.1** Set up external monitoring service (choose one):
  - [ ] UptimeRobot (free: 50 monitors)
  - [ ] Pingdom (free: 1 monitor)  
  - [ ] Better Stack (free plan)
  
- [ ] **5.2** Configure monitor settings:
  ```
  URL: https://your-service-url.onrender.com/ping
  Method: GET
  Interval: 5 minutes
  Timeout: 30 seconds
  ```

- [ ] **5.3** Verify keep-alive service status:
  ```bash
  curl https://your-service-url.onrender.com/health | jq '.services.keepAlive'
  ```

#### Phase 6: Performance Validation
- [ ] **6.1** Response time validation:
  - [ ] Health check: < 2 seconds
  - [ ] Database queries: < 1 second
  - [ ] File processing: < 10 seconds
  
- [ ] **6.2** Resource usage check:
  ```bash
  curl https://your-service-url.onrender.com/metrics | jq '.memory.usagePercent'
  # Should be < 80%
  ```

- [ ] **6.3** Free tier usage monitoring:
  ```bash
  curl https://your-service-url.onrender.com/metrics | jq '.renderFreeTier'
  # Track monthly hours used
  ```

#### Phase 7: Production Testing
- [ ] **7.1** End-to-end order processing test:
  - [ ] Send PDF to Telegram bot
  - [ ] Verify order extracted and saved
  - [ ] Check Excel export generation
  
- [ ] **7.2** Load testing (free tier limits):
  - [ ] Test 10 concurrent requests
  - [ ] Monitor memory usage during processing
  - [ ] Verify no crashes under load

- [ ] **7.3** Error handling verification:
  - [ ] Test with invalid PDF
  - [ ] Test with network disconnection
  - [ ] Verify graceful degradation

### Free Tier Optimization Checklist

#### Resource Management
- [ ] Memory usage stays below 400MB during normal operation
- [ ] Response times under 3 seconds for all endpoints
- [ ] Keep-alive prevents sleeping during business hours (8 AM - 8 PM CET)
- [ ] Logging optimized to reduce I/O overhead

#### Cost Controls
- [ ] AI API usage optimized:
  - [ ] Gemini 2.0 Flash for JSON processing (cheap)
  - [ ] GPT-4o only for image analysis (when needed)
  - [ ] Fallback chains configured
- [ ] Database connection pooling active
- [ ] File cleanup after processing
- [ ] Compressed logging in production

#### Monitoring Alerts
- [ ] Memory usage > 80% alert
- [ ] Monthly hours > 600 (80% of 750) alert
- [ ] Service down alert
- [ ] Database connection failures alert

### Emergency Procedures

#### Service Issues
- [ ] **Restart Service**: Render Dashboard → Service → Manual Deploy
- [ ] **Check Logs**: Render Dashboard → Service → Logs
- [ ] **Resource Usage**: Check `/metrics` endpoint
- [ ] **Database Status**: Check Supabase dashboard

#### Free Tier Limit Approaching
- [ ] Monitor usage at `/metrics` endpoint
- [ ] Plan upgrade to paid tier if needed
- [ ] Optimize processing to reduce hours
- [ ] Consider scheduled shutdowns

### Success Criteria ✅

**Functional Requirements:**
- [ ] Processes orders from Telegram/email reliably
- [ ] Extracts data with >95% accuracy
- [ ] Generates Excel reports in <5 seconds
- [ ] Handles 400 orders/month capacity

**Performance Requirements:**
- [ ] Health check response: <2 seconds
- [ ] Order processing: <10 seconds  
- [ ] Memory usage: <400MB average
- [ ] 99% uptime with monitoring

**Free Tier Compliance:**
- [ ] Stays within 750 hours/month
- [ ] Memory usage <512MB
- [ ] No unexpected charges
- [ ] Webhook reliability maintained

---

## 🚀 Deployment Complete!

**Service URL**: `https://your-actual-service-url.onrender.com`
**Health Check**: `https://your-actual-service-url.onrender.com/health`  
**Metrics**: `https://your-actual-service-url.onrender.com/metrics`
**Admin Panel**: https://dashboard.render.com

**Next Steps:**
1. Monitor resource usage daily for first week
2. Set up automated backup strategy  
3. Document operational procedures
4. Plan scaling strategy if usage grows

**Support Resources:**
- Render Documentation: https://render.com/docs
- Project Issues: Create GitHub issue
- Emergency Contact: [Your support contact]