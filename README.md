# 🚀 Pedidos Automation System

Multi-channel order processing automation system that processes 400+ orders/month from Outlook emails and Telegram messages using AI-powered data extraction.

## ✅ Phase 1 Complete - Foundation & Setup
- ✅ Project structure created
- ✅ Dependencies installed and configured
- ✅ Database schema designed
- ✅ Environment configuration ready
- ✅ Express server with health checks
- ✅ Database models and CRUD operations
- ✅ Logging and error handling system

## 🔧 Quick Start

### 1. Setup Environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 2. Setup Supabase Database
1. Create a new Supabase project
2. Run the SQL schema from `src/config/schema.sql` in your Supabase SQL Editor
3. Add your Supabase credentials to `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` 
   - `SUPABASE_SERVICE_KEY`

### 3. Add API Keys
Add these to your `.env` file:
- `OPENAI_API_KEY` (GPT-4 Vision for visual analysis)
- `DEEPSEEK_API_KEY` (DeepSeek R1 for conversational agent)
- `ANTHROPIC_API_KEY` (Claude 3.5 Sonnet as fallback)
- `TELEGRAM_BOT_TOKEN` (from @BotFather)

### 4. Start Development
```bash
npm install
npm run dev
```

### 5. Test Setup
```bash
# Test database connection
node src/tests/database-test.js

# Check health endpoint
curl http://localhost:3000/health
```

## 🏗️ Architecture

```
Multi-Channel Input → AI Processing → Database Storage → Telegram Bot Interface
     ↓                    ↓              ↓                    ↓
- Outlook Email      - GPT-4 Vision  - Supabase        - DeepSeek R1 Chat
- Telegram Bot       - DeepSeek R1   - PostgreSQL      - Excel Reports  
- PDF/Images         - Claude (fallback) - Transactions - Query Interface
```

## 📁 Project Structure
```
src/
├── app.js              # Main Express application
├── config/             # Database and API configurations
├── routes/             # Express routes
├── services/           # Business logic services
├── models/             # Database models
├── utils/              # Utility functions
└── tests/              # Test files
```

## 🔄 Next Phase: Database Operations & Telegram Bot
- Database integration and optimization
- Telegram bot interface development
- Natural language query processing
- Excel report generation

## 📊 Current Status
- **Phase 1**: ✅ Complete (Foundation & Setup)
- **Phase 2**: ✅ Complete (Input Channel Setup)
- **Phase 3**: ✅ Complete (AI Processing Engine)
- **Phase 4**: 🔄 Ready to start (Database Operations)
- **Phases 5-7**: ⏳ Pending

## 🎯 Success Metrics
- Process 400+ orders/month
- <10 second processing time per order
- >95% accuracy in data extraction
- <2 second query responses
- <5 second Excel report generation