# Render Deployment Troubleshooting Guide

## Common Render Errors and Solutions

### 1. HTTP 502 Bad Gateway
**Symptoms**: Service shows "Bad Gateway" when accessed
**Causes**: Application failed to start or crashed
**Solutions**:
- Check Render logs for startup errors
- Verify environment variables are set
- Check memory usage (free tier = 512MB limit)
- Ensure proper PORT configuration

### 2. HTTP 429 Too Many Requests
**Symptoms**: Service returns 429 status code
**Causes**: Application making too many API requests
**Solutions**:
- Disable keep-alive service temporarily (`RENDER_FREE_TIER=false`)
- Add startup delays to prevent restart loops
- Check rate limits on external APIs (Supabase, OpenAI, etc.)
- Monitor memory usage for restart cycles

### 3. HTTP 503 Service Unavailable
**Symptoms**: Intermittent availability, especially after periods of inactivity
**Causes**: Free tier service went to sleep
**Solutions**:
- Enable keep-alive service (`RENDER_FREE_TIER=true`)
- Configure external monitoring (UptimeRobot, etc.)
- Optimize startup time to reduce cold start impact

### 4. Build/Deploy Failures
**Symptoms**: Deployment fails during build process
**Causes**: Missing dependencies, build script errors
**Solutions**:
- Check `package.json` scripts are correct
- Verify all dependencies are in `package.json`
- Ensure Node.js version compatibility
- Check for missing environment variables during build

### 5. Memory Limit Exceeded
**Symptoms**: Application crashes with out-of-memory errors
**Causes**: Exceeding 512MB free tier limit
**Solutions**:
- Add `--max-old-space-size=512` to Node.js startup
- Monitor memory usage with `/metrics` endpoint
- Optimize large operations (file processing, AI requests)
- Implement proper cleanup of resources

## Debugging Steps

### 1. Check Render Logs
```
Go to Render Dashboard → Your Service → Logs
Look for error messages, startup failures, memory issues
```

### 2. Test Endpoints Locally
```bash
# Test health endpoint
curl https://your-service.onrender.com/health

# Check monitoring endpoint
curl https://your-service.onrender.com/metrics
```

### 3. Monitor Memory Usage
```bash
# In your application logs, look for:
# Memory warnings at startup
# Out of memory crashes
# Garbage collection frequency
```

### 4. Validate Environment Variables
```bash
# Check in Render dashboard that all required vars are set
# Verify no typos in variable names
# Ensure sensitive values are properly escaped
```

## Emergency Procedures

### Service Down (Critical)
1. **Immediate**: Check Render service status
2. **Quick Fix**: Restart service in Render dashboard
3. **Fallback**: Revert to last known working commit
4. **Communication**: Notify stakeholders of downtime

### Memory Issues
1. **Temporary**: Reduce LOG_LEVEL to 'error'
2. **Quick**: Disable non-essential services
3. **Medium**: Optimize memory usage in code
4. **Long-term**: Consider upgrading to paid tier

### Rate Limiting Issues
1. **Immediate**: Set RENDER_FREE_TIER=false
2. **Investigate**: Check API usage patterns
3. **Fix**: Implement exponential backoff
4. **Monitor**: Set up alerts for API usage

## Performance Optimization

### Startup Time
- Minimize startup operations
- Use lazy loading for services
- Reduce initial memory allocation
- Cache frequently used data

### Runtime Performance  
- Monitor `/metrics` endpoint regularly
- Set up external monitoring alerts
- Optimize database queries
- Implement proper error handling

### Resource Management
- Stay under 512MB memory limit
- Monitor CPU usage patterns
- Optimize file operations
- Clean up temporary resources

## Monitoring and Alerts

### Recommended Monitoring
1. **UptimeRobot**: External uptime monitoring
2. **Render Metrics**: Built-in service metrics
3. **Application Logs**: Custom logging for business logic
4. **API Usage**: Monitor third-party service usage

### Alert Thresholds
- **Memory Usage**: Alert at 400MB (80% of limit)
- **Response Time**: Alert if >5 seconds
- **Error Rate**: Alert if >5% of requests fail
- **Uptime**: Alert if down for >2 minutes

---
**Maintained by**: Development Team
**Last Updated**: December 2024
**Review Schedule**: Monthly