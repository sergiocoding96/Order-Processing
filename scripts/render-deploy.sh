#!/bin/bash

# Render Deployment Script for Leo Order Processing System
# Automates the deployment process to Render free tier

set -e  # Exit on any error

echo "🚀 Starting Render deployment for Leo Order Processing System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if git is available
    if ! command -v git &> /dev/null; then
        log_error "Git is not installed. Please install Git and try again."
        exit 1
    fi
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a Git repository. Please initialize Git and commit your code."
        exit 1
    fi
    
    # Check if we have uncommitted changes
    if [[ -n $(git status --porcelain) ]]; then
        log_warning "You have uncommitted changes. Commit them before deploying."
        echo "Uncommitted files:"
        git status --porcelain
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Deployment cancelled."
            exit 0
        fi
    fi
    
    # Check for required files
    required_files=("package.json" "src/app.js" "render.yaml")
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "Required file not found: $file"
            exit 1
        fi
    done
    
    log_success "Prerequisites check passed"
}

# Validate environment setup
validate_environment() {
    log_info "Validating environment configuration..."
    
    # Check if .env.render.template exists
    if [[ ! -f ".env.render.template" ]]; then
        log_error ".env.render.template not found. This file contains the environment variable template for Render."
        exit 1
    fi
    
    # Validate render.yaml
    if ! grep -q "leo-orders-api" render.yaml; then
        log_error "render.yaml does not contain expected service name 'leo-orders-api'"
        exit 1
    fi
    
    log_success "Environment validation passed"
}

# Test local build
test_local_build() {
    log_info "Testing local production build..."
    
    # Create temporary directories that would be created in production
    mkdir -p logs tmp/uploads tmp/reports tmp/processing
    
    # Test build command
    if ! npm run render:build > /dev/null 2>&1; then
        log_error "Local build test failed. Fix build issues before deploying."
        exit 1
    fi
    
    log_success "Local build test passed"
}

# Display deployment information
show_deployment_info() {
    echo
    log_info "=== RENDER DEPLOYMENT INFORMATION ==="
    echo
    echo "Service Name: leo-orders-api"
    echo "Region: Frankfurt (Europe)"
    echo "Plan: Free (750 hours/month)"
    echo "Runtime: Node.js"
    echo "Build Command: npm run render:build"
    echo "Start Command: npm run render:start"
    echo
    echo "Expected Service URL: https://leo-orders-api.onrender.com"
    echo "(Note: Actual URL may vary if name is taken)"
    echo
}

# Show environment variables that need to be set
show_environment_setup() {
    log_info "=== ENVIRONMENT VARIABLES SETUP ==="
    echo
    echo "After creating the service in Render, you'll need to set these environment variables:"
    echo
    echo "PUBLIC VARIABLES (can be visible):"
    echo "  NODE_ENV=production"
    echo "  PORT=10000"
    echo "  RENDER_FREE_TIER=true"
    echo "  LOG_LEVEL=info"
    echo "  WEBHOOK_BASE_URL=https://your-service-url.onrender.com"
    echo "  AUTO_EXPORT_XLS=true"
    echo
    echo "SECRET VARIABLES (encrypted in Render):"
    echo "  SUPABASE_URL=your-supabase-url"
    echo "  SUPABASE_ANON_KEY=your-anon-key"
    echo "  SUPABASE_SERVICE_KEY=your-service-key"
    echo "  OPENAI_API_KEY=your-openai-key"
    echo "  GEMINI_API_KEY=your-gemini-key"
    echo "  TELEGRAM_BOT_TOKEN=your-bot-token"
    echo "  LEOS_FOODS_CIF=your-cif-number"
    echo
    log_warning "See .env.render.template for complete list and instructions"
}

# Display next steps
show_next_steps() {
    echo
    log_info "=== NEXT STEPS ==="
    echo
    echo "1. Go to https://dashboard.render.com"
    echo "2. Click 'New' → 'Web Service'"
    echo "3. Connect your GitHub repository"
    echo "4. Configure the service with these settings:"
    echo "   - Name: leo-orders-api"
    echo "   - Region: Frankfurt"
    echo "   - Branch: main"
    echo "   - Build Command: npm run render:build"
    echo "   - Start Command: npm run render:start"
    echo "   - Plan: Free"
    echo
    echo "5. Add environment variables (see above)"
    echo "6. Deploy and monitor the build logs"
    echo "7. Test the deployed service:"
    echo "   curl https://your-service-url.onrender.com/health"
    echo
    echo "8. Update webhook URLs with your new service URL"
    echo "9. Set up monitoring service to prevent sleeping"
    echo
    log_success "Deployment preparation complete!"
}

# Main deployment flow
main() {
    echo "========================================"
    echo "  Render Deployment for Leo Orders"
    echo "========================================"
    echo
    
    check_prerequisites
    validate_environment
    test_local_build
    show_deployment_info
    show_environment_setup
    show_next_steps
    
    echo
    log_info "For detailed instructions, see: RENDER_DEPLOYMENT_COMPLETE.md"
    echo
}

# Handle interruption
trap 'echo; log_warning "Deployment preparation interrupted"; exit 130' INT

# Run main function
main