# Deployment Guide

## Docker (local)

1. Build image

```bash
docker build -t pedidos-automation .
```

2. Run container

```bash
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e GEMINI_API_KEY=$GEMINI_API_KEY \
  -e TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN \
  -e TELEGRAM_POLLING=true \
  -e SUPABASE_URL=$SUPABASE_URL \
  -e SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY \
  -e SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY \
  -e AUTO_EXPORT_XLS=true \
  -e XLS_OUTPUT_DIR="Test Files Leo Output" \
  pedidos-automation
```

## Railway

1. Connect repo to Railway (Dockerfile is auto-detected)
2. Set environment variables in the Railway dashboard
3. Deploy

## Heroku

1. Install Heroku CLI
2. Create app and set env vars
3. Deploy via GitHub or `git push heroku main`

Procfile used:
```
web: node src/app.js
```

## Required Environment Variables
- OPENAI_API_KEY
- GEMINI_API_KEY
- TELEGRAM_BOT_TOKEN
- TELEGRAM_POLLING=true
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_KEY
- AUTO_EXPORT_XLS=true
- XLS_OUTPUT_DIR (default: "Test Files Leo Output")
- LEOS_FOODS_CIF (optional)