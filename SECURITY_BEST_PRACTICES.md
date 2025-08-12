# 🔒 Security Best Practices for Order Processing System

## 🚨 Emergency Contact Information

**In case of security incident:**
1. **Immediately** stop all deployments
2. **Rotate** all compromised API keys
3. **Follow** emergency procedures below
4. **Document** incident for post-mortem

## 📋 Pre-Deployment Security Checklist

### ✅ Git Repository Security
- [ ] Run `npm run security:full` and ensure it passes
- [ ] No secrets in git history: `git log --all -S "sk-" --source --all` returns empty
- [ ] All `.env*` files properly ignored (except templates)
- [ ] No backup files (`.bak`, `.old`, `.backup`) committed
- [ ] Pre-commit hooks installed and working

### ✅ Environment Configuration
- [ ] All API keys rotated after security incident
- [ ] Environment validator passes: `node -e "import('./src/config/env-validator.js').then(m => m.validateEnvironment())"`
- [ ] No deprecated environment variables (DeepSeek, etc.)
- [ ] Production environment uses secure protocols (HTTPS)
- [ ] Rate limiting properly configured

### ✅ Dependency Security
- [ ] `npm audit --audit-level high` passes without high-severity vulnerabilities
- [ ] All dependencies up to date: `npm outdated`
- [ ] No unused dependencies in package.json

### ✅ Code Security
- [ ] No hardcoded API keys or secrets in code
- [ ] Input validation implemented for all user inputs
- [ ] SQL injection prevention active (parameterized queries)
- [ ] File upload restrictions and validation in place
- [ ] Error handling doesn't leak sensitive information

### ✅ Deployment Security
- [ ] HTTPS enforced for all communications
- [ ] Security headers configured (Helmet.js)
- [ ] CORS properly configured with restrictive origins
- [ ] Database connections use SSL/TLS
- [ ] Monitoring and alerting systems active

## 🔐 Secure API Key Management

### Key Generation Guidelines
1. **OpenAI**: Generate from https://platform.openai.com/api-keys
   - Use project-specific keys (starts with `sk-proj-`)
   - Enable usage limits and monitoring
   - Rotate every 90 days

2. **Google Gemini**: Generate from https://aistudio.google.com/app/apikey
   - Restrict API access to necessary services only
   - Enable quotas and monitoring
   - Rotate every 90 days

3. **Supabase**: Use project-specific keys from dashboard
   - Service key only for server-side operations
   - Anon key for client-side operations
   - Enable RLS (Row Level Security) policies

4. **Telegram Bot**: Generate from @BotFather
   - Use webhook mode in production (not polling)
   - Implement proper webhook validation
   - Consider using bot commands restrictions

### Key Storage Best Practices
- ✅ **DO**: Store in environment variables only
- ✅ **DO**: Use different keys for different environments
- ✅ **DO**: Implement key rotation schedules
- ✅ **DO**: Monitor key usage patterns
- ❌ **DON'T**: Hardcode keys in source code
- ❌ **DON'T**: Commit keys to version control
- ❌ **DON'T**: Share keys via insecure channels
- ❌ **DON'T**: Use production keys in development

## 🛡️ Environment Security Configuration

### Production Environment Template
```bash
# ===== PRODUCTION SECURITY SETTINGS =====
NODE_ENV=production
HTTPS_ENABLED=true
TRUST_PROXY=true

# Rate limiting (adjust based on expected traffic)
RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100    # 100 requests per window

# Security headers
HELMET_ENABLED=true
CORS_ORIGIN=https://yourdomain.com
CSP_ENABLED=true

# Database security
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=true

# File upload security
MAX_FILE_SIZE=10485760         # 10MB
ALLOWED_FILE_TYPES=pdf,jpg,png,xlsx
UPLOAD_TIMEOUT=30000           # 30 seconds

# AI processing limits
AI_PROCESSING_TIMEOUT=30000    # 30 seconds
MAX_PROCESSING_RETRIES=3
AI_RATE_LIMIT_PER_MINUTE=60
```

### Development Environment Security
```bash
# Development settings (less restrictive but still secure)
NODE_ENV=development
DEBUG_ENABLED=true             # But never log sensitive data

# Use separate API keys for development
OPENAI_API_KEY=sk-proj-dev-...
GEMINI_API_KEY=AIza-dev-...
SUPABASE_URL=https://dev-project.supabase.co

# Relaxed rate limiting for development
RATE_LIMIT_WINDOW_MS=60000     # 1 minute
RATE_LIMIT_MAX_REQUESTS=1000   # Higher limit for testing
```

## 🚨 Emergency Response Procedures

### Scenario 1: API Key Exposed in Git History

**Immediate Actions (< 5 minutes):**
1. **Identify** which keys were exposed
2. **Disable/Delete** exposed keys immediately from respective platforms
3. **Generate** new keys with different values
4. **Update** production environment variables
5. **Deploy** with new keys

**Git History Cleanup (< 30 minutes):**
```bash
# OPTION A: BFG Repo-Cleaner (recommended)
java -jar bfg.jar --delete-files '.env*' .
java -jar bfg.jar --delete-files '*.bak' .
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# OPTION B: Git filter-branch
git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch .env.bak' --prune-empty --tag-name-filter cat -- --all

# Force push (coordinate with team first)
git push origin --force --all
```

**Post-Incident (< 2 hours):**
- Monitor API usage for unusual patterns
- Review access logs for unauthorized usage
- Update security documentation
- Conduct team security training session

### Scenario 2: Suspicious API Usage Detected

**Investigation Steps:**
1. **Review** security monitor alerts
2. **Check** API usage patterns and logs
3. **Identify** source of suspicious activity
4. **Temporarily disable** affected API keys if needed

**Mitigation:**
- Implement additional rate limiting
- Add IP-based restrictions if possible
- Enhance monitoring and alerting
- Consider implementing API key rotation

### Scenario 3: Database Security Breach

**Immediate Response:**
1. **Isolate** affected database instance
2. **Change** all database credentials
3. **Enable** additional security logging
4. **Assess** data exposure scope

**Recovery:**
- Restore from clean backup if necessary
- Implement additional access controls
- Update connection security settings
- Conduct security audit

### Scenario 4: Pre-commit Hooks Bypassed

**Assessment:**
1. **Check** what sensitive data was committed
2. **Determine** if secrets need rotation
3. **Review** bypass method used

**Response:**
- Immediately clean git history if secrets found
- Strengthen pre-commit hook enforcement
- Add server-side hooks if necessary
- Train team on proper procedures

## 📊 Security Monitoring and Alerting

### Key Metrics to Monitor
- API error rates and patterns
- Authentication failure rates
- File upload rejections
- Rate limiting violations
- Unusual response times
- High token usage patterns

### Alert Thresholds
- **Critical**: 10+ API errors in 5 minutes
- **Warning**: 5+ validation failures in 5 minutes
- **Critical**: 3+ rate limit violations in 1 minute
- **Warning**: 20+ unusual events in 10 minutes

### Monitoring Commands
```bash
# Security scan
npm run security:scan

# Full security audit
npm run security:full

# Check environment configuration
node -e "import('./src/config/env-validator.js').then(m => console.log(JSON.stringify(m.validateEnvironment(), null, 2)))"

# Monitor security events
node -e "import('./src/utils/security-monitor.js').then(m => console.log(JSON.stringify(m.getSecuritySummary(), null, 2)))"
```

## 🔧 Security Tools Integration

### Pre-commit Hooks
```bash
# Install security tools
npm install -g pre-commit
brew install gitleaks

# Install hooks
pre-commit install

# Manual security scan
gitleaks detect --source . --verbose
```

### Continuous Integration
- GitHub Actions security pipeline runs on every push
- Automated dependency vulnerability scanning
- Secret detection in pull requests
- Security summary reports

### Production Monitoring
- Real-time security event logging
- Automated alert notifications
- API usage pattern analysis
- Anomaly detection

## 📚 Security Training and Awareness

### Developer Guidelines
1. **Never** commit sensitive data
2. **Always** use environment variables for secrets
3. **Regularly** rotate API keys
4. **Review** security checklist before deployment
5. **Report** security concerns immediately

### Regular Security Practices
- Weekly security scan reviews
- Monthly API key rotation
- Quarterly security training sessions
- Annual security audit and penetration testing

### Security Resources
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [Supabase Security Guide](https://supabase.com/docs/guides/platform/going-into-prod)
- [OpenAI Security Best Practices](https://platform.openai.com/docs/guides/safety-best-practices)

## 📞 Incident Communication Plan

### Internal Communication
1. **Immediate**: Notify development team via Slack/email
2. **Within 1 hour**: Update project stakeholders
3. **Within 24 hours**: Provide incident summary and lessons learned

### External Communication (if customer data affected)
1. **Within 24 hours**: Notify affected users
2. **Within 72 hours**: Submit regulatory reports if required
3. **Follow-up**: Provide resolution summary and prevention measures

## 🔄 Security Maintenance Schedule

### Daily
- Monitor security alerts and logs
- Review failed authentication attempts

### Weekly  
- Run comprehensive security scans
- Check for outdated dependencies
- Review API usage patterns

### Monthly
- Rotate API keys and secrets
- Update security documentation
- Review and test incident response procedures

### Quarterly
- Conduct security training sessions
- Perform security architecture review
- Update security tools and configurations

### Annually
- External security audit
- Penetration testing
- Security policy review and updates

---

## 🆘 Emergency Contacts

**Security Incident Hotline**: [Your emergency contact]
**Platform Support**:
- OpenAI: https://platform.openai.com/support
- Supabase: https://supabase.com/support
- Google Cloud: https://cloud.google.com/support

**Remember**: Security is everyone's responsibility. When in doubt, err on the side of caution and ask for help!