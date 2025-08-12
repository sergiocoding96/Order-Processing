#!/bin/bash

# Leo Order Processing System - Railway Deployment Script
set -e

echo "🚀 Starting deployment to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed. Install with: npm install -g @railway/cli"
    exit 1
fi

# Login check
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged into Railway. Run: railway login"
    exit 1
fi

# Environment check
echo "📋 Checking environment variables..."
REQUIRED_VARS=(
    "SUPABASE_URL"
    "SUPABASE_ANON_KEY" 
    "SUPABASE_SERVICE_KEY"
    "OPENAI_API_KEY"
    "TELEGRAM_BOT_TOKEN"
)

for var in "${REQUIRED_VARS[@]}"; do
    if ! railway variables get $var &> /dev/null; then
        echo "❌ Missing required environment variable: $var"
        echo "Set it with: railway variables set $var=your_value"
        exit 1
    fi
done

echo "✅ Environment variables validated"

# Pre-deployment tests
echo "🧪 Running pre-deployment tests..."
npm test || {
    echo "❌ Tests failed. Fix issues before deploying."
    exit 1
}

echo "✅ Tests passed"

# Build and deploy
echo "🏗️  Building and deploying..."
railway up --detach

echo "⏳ Waiting for deployment to complete..."
sleep 30

# Health check
RAILWAY_DOMAIN=$(railway domain)
if [ -z "$RAILWAY_DOMAIN" ]; then
    echo "❌ Could not get Railway domain. Check deployment status."
    exit 1
fi

echo "🩺 Running health check..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$RAILWAY_DOMAIN/health" || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Deployment successful!"
    echo "🌍 App URL: https://$RAILWAY_DOMAIN"
    echo "📊 Health Check: https://$RAILWAY_DOMAIN/health"
    echo "📋 Logs: railway logs"
else
    echo "❌ Health check failed (HTTP $HTTP_STATUS)"
    echo "🔍 Check logs: railway logs"
    exit 1
fi

echo "🎉 Deployment complete!"