#!/bin/bash

# Leo Orders System - Google Cloud Run Deployment Script
# Makes deployment to Google Cloud Run simple and automated

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="leo-orders-system"
SERVICE_NAME="leo-orders-system"
REGION="europe-west3"
ENV_FILE=".env.production"

echo -e "${GREEN}🚀 Leo Orders System - Cloud Run Deployment${NC}"
echo -e "${BLUE}=================================================${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if gcloud is installed
if ! command_exists gcloud; then
    echo -e "${RED}❌ Google Cloud CLI not found.${NC}"
    echo -e "${YELLOW}📥 Install from: https://cloud.google.com/sdk/docs/install${NC}"
    exit 1
fi

# Check if Docker is installed
if ! command_exists docker; then
    echo -e "${RED}❌ Docker not found.${NC}"
    echo -e "${YELLOW}📥 Install from: https://docs.docker.com/get-docker/${NC}"
    exit 1
fi

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  $ENV_FILE not found.${NC}"
    if [ -f ".env.production.template" ]; then
        echo -e "${YELLOW}📝 Creating $ENV_FILE from template...${NC}"
        cp .env.production.template $ENV_FILE
        echo -e "${GREEN}✅ Template copied to $ENV_FILE${NC}"
        echo -e "${YELLOW}📝 Please edit $ENV_FILE with your production values${NC}"
        echo -e "${YELLOW}🔧 Then run this script again${NC}"
    else
        echo -e "${RED}❌ No template found. Please create $ENV_FILE manually.${NC}"
    fi
    exit 1
fi

# Check if user is logged in to gcloud
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n 1 > /dev/null 2>&1; then
    echo -e "${YELLOW}🔐 Please login to Google Cloud...${NC}"
    gcloud auth login
fi

# Check if project exists, create if not
echo -e "${BLUE}🏗️  Setting up Google Cloud project...${NC}"
if ! gcloud projects describe $PROJECT_ID > /dev/null 2>&1; then
    echo -e "${YELLOW}📁 Creating project $PROJECT_ID...${NC}"
    gcloud projects create $PROJECT_ID --name="Leo Orders System"
    echo -e "${GREEN}✅ Project created${NC}"
fi

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${BLUE}🔧 Enabling required APIs...${NC}"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com

# Build and deploy
echo -e "${BLUE}🚀 Building and deploying to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
    --source . \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port=8080 \
    --memory=1Gi \
    --cpu=1 \
    --timeout=300 \
    --concurrency=100 \
    --max-instances=10 \
    --env-vars-file=$ENV_FILE \
    --quiet

# Check if deployment was successful
if [ $? -eq 0 ]; then
    # Get the deployed URL
    URL=$(gcloud run services describe $SERVICE_NAME \
        --platform managed \
        --region $REGION \
        --format 'value(status.url)')
    
    echo -e "${GREEN}=================================================${NC}"
    echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
    echo -e "${GREEN}🌐 Your app is running at:${NC}"
    echo -e "${BLUE}   $URL${NC}"
    echo -e "${GREEN}=================================================${NC}"
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo -e "${YELLOW}   1. Update WEBHOOK_BASE_URL in $ENV_FILE to: $URL${NC}"
    echo -e "${YELLOW}   2. Update your Telegram webhook: $URL/webhook/telegram${NC}"
    echo -e "${YELLOW}   3. Update your Outlook webhook: $URL/webhook/outlook${NC}"
    echo -e "${YELLOW}   4. Test your webhooks: $URL/health${NC}"
    echo -e "${GREEN}=================================================${NC}"
    
    # Test the health endpoint
    echo -e "${BLUE}🔍 Testing health endpoint...${NC}"
    if curl -s "$URL/health" > /dev/null; then
        echo -e "${GREEN}✅ Health check passed!${NC}"
    else
        echo -e "${YELLOW}⚠️  Health check failed - check logs${NC}"
    fi
    
else
    echo -e "${RED}❌ Deployment failed!${NC}"
    echo -e "${YELLOW}📋 Check the error messages above${NC}"
    echo -e "${YELLOW}🔍 View logs: gcloud logs tail \"resource.type=cloud_run_revision\"${NC}"
    exit 1
fi

# Show useful commands
echo -e "${BLUE}🛠️  Useful commands:${NC}"
echo -e "${YELLOW}   View logs: gcloud logs tail \"resource.type=cloud_run_revision\"${NC}"
echo -e "${YELLOW}   List services: gcloud run services list${NC}"
echo -e "${YELLOW}   Delete service: gcloud run services delete $SERVICE_NAME --region=$REGION${NC}"
echo -e "${YELLOW}   Update deployment: ./deploy-cloud-run.sh${NC}"

echo -e "${GREEN}🎉 Happy order processing!${NC}"