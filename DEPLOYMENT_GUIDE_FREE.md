# FREE Deployment Guide: Leo Order Processing System

## 🏆 RECOMMENDED: Google Cloud Run Deployment

Google Cloud Run is the **best free option** for the Leo order processing system, offering:
- **Completely free** for 400 orders/month usage
- **Europe region** (Frankfurt) available  
- **No cold starts** for webhook endpoints
- **Reliable scaling** and webhook handling
- **180,000 vCPU-seconds/month** free tier

### Prerequisites

1. **Google Cloud Account** (free, no credit card required initially)
2. **Docker** installed locally
3. **Google Cloud CLI** installed

### Step 1: Install Google Cloud CLI

```bash
# macOS
brew install --cask google-cloud-sdk

# Linux
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Windows
# Download from: https://cloud.google.com/sdk/docs/install
```

### Step 2: Authenticate and Setup Project

```bash
# Login to Google Cloud
gcloud auth login

# Create a new project (or use existing)
gcloud projects create leo-orders-system --name="Leo Orders System"

# Set the project
gcloud config set project leo-orders-system

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### Step 3: Configure Environment Variables

Create a `.env.production` file:

```env
# Database (your existing Supabase)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# AI Services
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_anthropic_key

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_token

# Application
NODE_ENV=production
PORT=8080
WEBHOOK_BASE_URL=https://leo-orders-system-xxxx-ey.a.run.app
```

### Step 4: Deploy to Cloud Run

```bash
# Build and deploy in one command
gcloud run deploy leo-orders-system \
  --source . \
  --platform managed \
  --region europe-west3 \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --cpu=1 \
  --timeout=300 \
  --concurrency=100 \
  --max-instances=10 \
  --env-vars-file=.env.production

# Get the deployed URL
gcloud run services describe leo-orders-system \
  --platform managed \
  --region europe-west3 \
  --format 'value(status.url)'
```

### Step 5: Update Webhook URLs

Update your webhook URLs in:
1. **Telegram Bot**: Use `/setWebhook` with your new Cloud Run URL
2. **Outlook/Microsoft Graph**: Update webhook endpoint in your app registration

### Step 6: Set Up Custom Domain (Optional)

```bash
# Map custom domain
gcloud run domain-mappings create \
  --service leo-orders-system \
  --domain orders.yourdomain.com \
  --region europe-west3
```

### Step 7: Monitor Usage

```bash
# Check deployment
gcloud run services list

# View logs
gcloud logs tail "resource.type=cloud_run_revision"

# Monitor usage (stay within free tier)
gcloud logging read "resource.type=cloud_run_revision" --limit=50
```

---

## 🥈 Alternative: Koyeb (Europe-focused)

If you prefer a simpler European option:

### Prerequisites
- Koyeb account (free, no credit card required)
- GitHub repository

### Deployment Steps

1. **Sign up** at [koyeb.com](https://www.koyeb.com)
2. **Connect GitHub** repository
3. **Select Frankfurt** region
4. **Configure environment variables** in Koyeb dashboard
5. **Deploy** with one click

**Koyeb Specs:**
- 512MB RAM, 0.1 vCPU
- Always-on (no cold starts)
- Built-in CDN
- Frankfurt, Germany region

---

## 🥉 Alternative: Back4app Containers

For Docker-based deployment:

### Prerequisites
- Back4app account (no credit card required)
- GitHub repository with Dockerfile

### Deployment Steps

1. **Sign up** at [back4app.com](https://www.back4app.com)
2. **Connect GitHub** repository
3. **Configure** environment variables
4. **Deploy** container

**Back4app Specs:**
- 600 server hours/month
- 256MB RAM, 0.25 CPU
- 100GB transfer/month

---

## 📊 Cost Comparison

| Service | Cost | CPU | RAM | Always On | Europe | Cold Start |
|---------|------|-----|-----|-----------|--------|------------|
| **Google Cloud Run** | FREE | 1 vCPU | 1GB | ✅ | Frankfurt | No |
| **Koyeb** | FREE | 0.1 vCPU | 512MB | ✅ | Frankfurt | No |
| **Back4app** | FREE | 0.25 vCPU | 256MB | ✅ | Global | No |
| Render | FREE | 0.5 vCPU | 512MB | ❌ | Global | Yes (15min) |
| Railway | $5/month | - | - | - | - | - |

---

## 🚀 Quick Start Script

Save this as `deploy-cloud-run.sh`:

```bash
#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Leo Orders System - Cloud Run Deployment${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Google Cloud CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${YELLOW}⚠️  .env.production not found. Creating template...${NC}"
    cp .env.example .env.production
    echo -e "${YELLOW}📝 Please edit .env.production with your production values${NC}"
    exit 1
fi

# Deploy
echo -e "${GREEN}🏗️  Deploying to Cloud Run...${NC}"
gcloud run deploy leo-orders-system \
  --source . \
  --platform managed \
  --region europe-west3 \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --cpu=1 \
  --timeout=300 \
  --concurrency=100 \
  --max-instances=10 \
  --env-vars-file=.env.production

# Get URL
URL=$(gcloud run services describe leo-orders-system \
  --platform managed \
  --region europe-west3 \
  --format 'value(status.url)')

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${GREEN}🌐 Your app is running at: ${URL}${NC}"
echo -e "${YELLOW}📝 Remember to update your webhook URLs!${NC}"
```

Make it executable and run:

```bash
chmod +x deploy-cloud-run.sh
./deploy-cloud-run.sh
```

---

## 🔧 Troubleshooting

### Common Issues

1. **Build Fails**: Check Dockerfile and ensure all dependencies are in package.json
2. **Environment Variables**: Verify .env.production has all required variables
3. **Memory Issues**: Increase memory allocation if processing large PDFs
4. **Webhook Timeouts**: Ensure health check endpoint responds quickly

### Monitoring Free Tier Usage

```bash
# Check CPU usage
gcloud logging read "resource.type=cloud_run_revision AND protoPayload.methodName=google.cloud.run.v1.Services.GetService" --limit=10

# Monitor requests
gcloud logging read "resource.type=cloud_run_revision AND severity>=INFO" --limit=50
```

---

## 🎯 Why Google Cloud Run is Perfect for Leo

1. **400 orders/month** ≈ 13 orders/day
2. **Each order processing** ≈ 10 seconds
3. **Total monthly usage** ≈ 4,000 seconds
4. **Free tier limit** = 180,000 seconds
5. **Usage percentage** = 2.2% of free tier

You'll use less than 3% of the free tier limits! 🎉

---

## 📞 Support

If you encounter issues:
1. Check Google Cloud Console logs
2. Verify environment variables
3. Test locally with Docker first
4. Monitor free tier usage regularly

**Estimated setup time:** 30 minutes
**Ongoing cost:** $0.00/month
**Reliability:** Enterprise-grade