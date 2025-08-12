# 🔒 Secure Render Deployment Guide

## 🚨 CRITICAL: API Key Security for Render Deployment

**⚠️ NEVER share actual API keys in this document or any public repository!**

This guide shows you how to securely generate and configure new API keys for Render deployment after the security incident.

## 📋 Pre-Deployment Security Verification

### 1. Git History Cleanup (REQUIRED FIRST)
Before deploying, you MUST clean the Git history to remove exposed secrets:

```bash
# Execute ONE of these cleanup methods from EMERGENCY_GIT_CLEANUP.md:

# OPTION A: BFG Repo-Cleaner (recommended)
java -jar bfg.jar --delete-files '.env*' .
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# OPTION B: Complete history rewrite
git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch .env.bak' --prune-empty --tag-name-filter cat -- --all

# Verify cleanup worked
git log --all -S "sk-proj-" --source --all  # Should return empty
git log --all -S "AIzaSy" --source --all    # Should return empty
```

### 2. Security Validation
```bash
# Install and run security setup
chmod +x ./scripts/setup-security.sh
./scripts/setup-security.sh

# Verify all security checks pass
npm run security:full
```

## 🔑 Generate New API Keys (DO THIS YOURSELF)

### 1. OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Name it "Order Processing Production"
4. **Copy the key** (starts with `sk-proj-` or `sk-`)
5. Set usage limits and monitoring

### 2. Google Gemini API Key
1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Select appropriate project
4. **Copy the key** (starts with `AIza`)
5. Enable quotas and restrictions

### 3. Supabase Keys (If Creating New Project)
1. Go to https://supabase.com/dashboard
2. Create new project "leo-orders-prod" 
3. Go to Settings → API
4. **Copy both keys**:
   - Project URL (https://xxx.supabase.co)
   - `anon` public key (starts with `eyJ`)
   - `service_role` secret key (starts with `eyJ`)

### 4. Telegram Bot Token (If Needed)
1. Message @BotFather on Telegram
2. Use `/newbot` or `/token` for existing bot
3. **Copy the token** (format: `123456789:ABC...`)

## 🚀 Secure Render Configuration

### Step 1: Environment Variables Setup
In your Render dashboard, add these environment variables:

**Database Configuration:**
```
SUPABASE_URL=https://[YOUR-PROJECT-ID].supabase.co
SUPABASE_ANON_KEY=eyJ[YOUR-ANON-KEY]
SUPABASE_SERVICE_KEY=eyJ[YOUR-SERVICE-KEY]
```

**AI APIs:**
```
OPENAI_API_KEY=sk-[YOUR-OPENAI-KEY]
GEMINI_API_KEY=AIza[YOUR-GEMINI-KEY]
ANTHROPIC_API_KEY=sk-ant-[YOUR-ANTHROPIC-KEY]  # Optional
```

**Telegram Bot:**
```
TELEGRAM_BOT_TOKEN=[YOUR-BOT-TOKEN]
```

**Application Settings:**
```
NODE_ENV=production
PORT=10000
WEBHOOK_BASE_URL=https://[YOUR-RENDER-SERVICE].onrender.com
```

**Security Settings:**
```
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
MAX_FILE_SIZE=10485760
AI_PROCESSING_TIMEOUT=30000
```

**File Processing:**
```
XLS_OUTPUT_DIR=/tmp/reports
UPLOAD_DIR=/tmp/uploads
```

**Logging:**
```
LOG_LEVEL=info
LOG_FORMAT=json
```

### Step 2: Render Service Configuration

**Build Command:**
```bash
npm ci --production && npm run build:production
```

**Start Command:**
```bash
npm run start:production
```

**Health Check Endpoint:**
```
/health
```

**Environment:**
- Node.js 18+
- Auto-deploy from `main` branch

### Step 3: Security Headers Configuration
These are handled automatically by the application via Helmet.js:
- Content Security Policy
- HTTPS enforcement
- Security headers
- CORS restrictions

## 🛡️ Post-Deployment Security Verification

### 1. Verify Deployment Security
```bash
# Test health endpoint
curl https://[YOUR-SERVICE].onrender.com/health

# Verify environment configuration (from logs, not exposed)
# Check Render logs for "Environment validation passed"

# Test security headers
curl -I https://[YOUR-SERVICE].onrender.com/health
# Should show security headers like:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Strict-Transport-Security: max-age=31536000
```

### 2. API Security Testing
```bash
# Test rate limiting (should block after threshold)
for i in {1..110}; do curl https://[YOUR-SERVICE].onrender.com/health; done

# Test file upload restrictions
curl -X POST https://[YOUR-SERVICE].onrender.com/webhook/telegram \
  -F "file=@malicious.exe" \
  # Should be rejected

# Test invalid requests
curl -X POST https://[YOUR-SERVICE].onrender.com/webhook/telegram \
  -H "Content-Type: application/json" \
  -d '{"invalid": "payload"}'
  # Should return proper error without leaking info
```

### 3. Monitor Security Events
After deployment, monitor the logs for:
- ✅ "Environment validation passed"
- ✅ "Security monitoring active" 
- ✅ "Pre-commit hooks verified"
- ❌ Any security alerts or failures

## 📊 Security Monitoring Dashboard

### Key Metrics to Monitor
1. **API Error Rates**: Should be < 5% under normal load
2. **Response Times**: Should be < 2 seconds for most requests
3. **Memory Usage**: Should stay < 80% of allocated memory
4. **Failed Authentication**: Should be minimal
5. **Rate Limit Hits**: Monitor for abuse patterns

### Alert Thresholds
- **Critical**: Error rate > 10% for 5 minutes
- **Warning**: Response time > 5 seconds
- **Critical**: Memory usage > 90%
- **Warning**: Unusual traffic patterns

## 🔄 Ongoing Security Maintenance

### Daily
- Check Render logs for security events
- Monitor API usage patterns
- Verify service health

### Weekly
- Review security monitoring dashboard
- Check for dependency updates
- Verify backup and recovery procedures

### Monthly
- Rotate API keys (recommended)
- Review and test incident response
- Update security configurations

### Security Automation
The deployed service includes:
- Automated dependency scanning
- Real-time security monitoring
- Anomaly detection and alerting
- Automated log analysis

## 🚨 Emergency Procedures

### If Security Incident Detected
1. **Immediately**: Disable affected API keys
2. **Within 5 minutes**: Generate new keys
3. **Within 15 minutes**: Update Render environment variables
4. **Within 30 minutes**: Redeploy with new configuration
5. **Within 1 hour**: Verify security and document incident

### Quick Key Rotation
```bash
# 1. Generate new keys (manually from platforms)
# 2. Update Render environment variables
# 3. Redeploy service
# 4. Test functionality
# 5. Monitor for issues
```

### Rollback Procedure
If deployment fails:
1. Go to Render dashboard
2. Select previous deployment
3. Click "Rollback"
4. Monitor service health
5. Fix issues and redeploy

## ✅ Deployment Success Checklist

### Pre-Deployment
- [ ] Git history cleaned of all secrets
- [ ] Security tools installed and configured
- [ ] All security scans pass
- [ ] New API keys generated
- [ ] Environment variables configured in Render

### During Deployment
- [ ] Build completes without errors
- [ ] Service starts successfully
- [ ] Health check endpoint responds
- [ ] Environment validation passes

### Post-Deployment
- [ ] API functionality works end-to-end
- [ ] Telegram bot responds to commands
- [ ] File processing works correctly
- [ ] Security headers present
- [ ] Rate limiting active
- [ ] Monitoring and alerting functional

## 📞 Support and Troubleshooting

### Common Issues
1. **Build failures**: Check Node.js version and dependencies
2. **Environment validation errors**: Verify API key formats
3. **Database connection issues**: Check Supabase URLs and keys
4. **Rate limiting too aggressive**: Adjust thresholds in environment

### Getting Help
- **Render Support**: https://render.com/docs
- **Supabase Support**: https://supabase.com/support  
- **OpenAI Support**: https://platform.openai.com/support

---

## 🎯 Remember: Security First!

1. **Never** commit API keys to git
2. **Always** use environment variables
3. **Regularly** rotate credentials
4. **Monitor** for security events
5. **Test** security measures after deployment

Your production system is now secure and ready for deployment! 🚀