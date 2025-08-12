# Environment Variables Configuration

## Required for Production Deployment

### Database Configuration
```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here  
SUPABASE_SERVICE_KEY=your-service-key-here
```

### AI API Keys
```
OPENAI_API_KEY=sk-proj-your-openai-key-here
GEMINI_API_KEY=your-gemini-api-key-here
```

### Communication
```
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here
```

### Server Configuration
```
NODE_ENV=production
PORT=10000
LOG_LEVEL=info
```

### Render-Specific Configuration
```
RENDER_FREE_TIER=true          # Enable/disable keep-alive service
STARTUP_DELAY=5000             # Milliseconds to wait during startup
MEMORY_LIMIT=400               # MB - stay under 512MB free tier limit
HEALTH_CHECK_TIMEOUT=30000     # Health check timeout in milliseconds
```

## Security Notes

⚠️ **CRITICAL**: These are production credentials. Handle with extreme care:

1. **Never commit** these values to version control
2. **Rotate regularly** (monthly recommended)
3. **Monitor usage** for unauthorized access
4. **Use separate keys** for development/testing

## Environment Variable Validation

The application validates these on startup:
- **Required**: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY
- **Recommended**: OPENAI_API_KEY, GEMINI_API_KEY
- **Optional**: TELEGRAM_BOT_TOKEN, ANTHROPIC_API_KEY

## Render Dashboard Configuration

1. Go to your service in Render dashboard
2. Navigate to "Environment" tab
3. Add each variable as Name/Value pairs
4. Click "Save" to trigger redeployment

## Local Development

For local development, create a `.env` file (never commit this):
```bash
cp .env.example .env
# Edit .env with your development keys
```

---
**Security Classification**: CONFIDENTIAL
**Last Updated**: December 2024