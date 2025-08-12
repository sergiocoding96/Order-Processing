#!/bin/bash

# Security Setup Script for Order Processing System
# This script sets up comprehensive security measures to prevent API key exposure

set -e

echo "🔒 Setting up comprehensive security measures..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ This must be run from the root of your git repository${NC}"
    exit 1
fi

echo "📋 Installing security dependencies..."

# Install pre-commit if not already installed
if ! command -v pre-commit &> /dev/null; then
    echo "Installing pre-commit..."
    if command -v brew &> /dev/null; then
        brew install pre-commit
    elif command -v pip3 &> /dev/null; then
        pip3 install pre-commit
    elif command -v pip &> /dev/null; then
        pip install pre-commit
    else
        echo -e "${RED}❌ Please install pre-commit manually: https://pre-commit.com/#installation${NC}"
        exit 1
    fi
fi

# Install gitleaks if not already installed
if ! command -v gitleaks &> /dev/null; then
    echo "Installing gitleaks..."
    if command -v brew &> /dev/null; then
        brew install gitleaks
    else
        echo -e "${YELLOW}⚠️  Please install gitleaks manually: https://github.com/gitleaks/gitleaks#installation${NC}"
    fi
fi

# Install pre-commit hooks
echo "🔧 Installing pre-commit hooks..."
pre-commit install

# Run initial security scan
echo "🔍 Running initial security scan..."
pre-commit run --all-files || {
    echo -e "${YELLOW}⚠️  Pre-commit checks found issues. Please fix them before proceeding.${NC}"
    echo "Run 'pre-commit run --all-files' to see detailed issues."
}

# Add security validation to package.json
echo "📦 Adding security scripts to package.json..."
if command -v npm &> /dev/null; then
    # Add security audit script if not exists
    npm pkg set scripts.security:audit="npm audit --audit-level high"
    npm pkg set scripts.security:scan="gitleaks detect --source . --verbose"
    npm pkg set scripts.security:full="npm run security:audit && npm run security:scan"
    npm pkg set scripts.security:fix="npm audit fix --force"
    
    echo -e "${GREEN}✅ Added security scripts to package.json${NC}"
    echo "  - npm run security:audit  # Check for vulnerable dependencies"
    echo "  - npm run security:scan   # Scan for secrets in repository"  
    echo "  - npm run security:full   # Run complete security check"
    echo "  - npm run security:fix    # Auto-fix vulnerable dependencies"
fi

# Create security checklist
cat << 'EOF' > SECURITY_CHECKLIST.md
# 🔒 Security Checklist

## Pre-Deployment Security Verification

### ✅ Git Repository Security
- [ ] All sensitive files in .gitignore
- [ ] No secrets in git history (run `git log --all -S "sk-" --source --all`)
- [ ] Pre-commit hooks installed and working
- [ ] Gitleaks scan passes (`npm run security:scan`)

### ✅ Dependency Security  
- [ ] No high-severity vulnerabilities (`npm run security:audit`)
- [ ] All dependencies up to date
- [ ] Unused dependencies removed

### ✅ Environment Security
- [ ] All API keys rotated after incident
- [ ] Environment variables properly configured
- [ ] No hardcoded secrets in code
- [ ] .env files not tracked in git

### ✅ Code Security
- [ ] Input validation implemented
- [ ] SQL injection prevention active
- [ ] Rate limiting configured
- [ ] Error handling doesn't leak sensitive info
- [ ] File upload restrictions in place

### ✅ Deployment Security
- [ ] HTTPS configured
- [ ] Security headers enabled (Helmet.js)
- [ ] CORS properly configured
- [ ] Database connections secure
- [ ] Monitoring and alerting active

## Emergency Procedures

### If API Keys Are Compromised:
1. **Immediately rotate** all affected keys
2. **Update** environment variables 
3. **Scan** git history for exposure
4. **Clean** git history if needed
5. **Deploy** with new credentials
6. **Monitor** for unusual activity

### If Security Scan Fails:
1. **Stop** all deployments
2. **Review** flagged issues
3. **Fix** security problems  
4. **Re-run** security scan
5. **Proceed** only when clean

## Security Tools Integration

- **Pre-commit hooks**: Prevent secrets from being committed
- **Gitleaks**: Detect secrets in repository history
- **npm audit**: Check for vulnerable dependencies
- **GitHub Actions**: Automated security scanning in CI/CD
EOF

echo -e "${GREEN}✅ Created SECURITY_CHECKLIST.md${NC}"

# Test the security setup
echo "🧪 Testing security setup..."

# Create a temporary test file with a fake secret
echo "sk-test-fake-key-for-testing" > temp_test_secret.txt
git add temp_test_secret.txt

# Try to commit (should fail)
echo "Testing pre-commit hooks..."
if git commit -m "Test commit (should fail)" &> /dev/null; then
    echo -e "${RED}❌ Pre-commit hooks are not working correctly!${NC}"
    git reset --soft HEAD~1
    rm temp_test_secret.txt
    exit 1
else
    echo -e "${GREEN}✅ Pre-commit hooks are working correctly${NC}"
    git reset HEAD temp_test_secret.txt
    rm temp_test_secret.txt
fi

echo ""
echo -e "${GREEN}🎉 Security setup completed successfully!${NC}"
echo ""
echo "📋 Next steps:"
echo "1. Review and run git history cleanup commands in EMERGENCY_GIT_CLEANUP.md"
echo "2. Set up GitHub Actions security pipeline"
echo "3. Configure monitoring and alerting"
echo "4. Review SECURITY_CHECKLIST.md before each deployment"
echo ""
echo "🔍 Run security checks anytime with:"
echo "  npm run security:full"
echo ""
echo -e "${YELLOW}⚠️  Remember: Never commit .env files or API keys!${NC}"