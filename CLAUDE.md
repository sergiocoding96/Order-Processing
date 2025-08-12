# Pedidos Automation System

## Project Overview
Multi-channel order processing system that extracts data from emails/Telegram and provides conversational interface for 400 orders/month.

## Tech Stack
- Node.js + Express.js
- Supabase (PostgreSQL)
- gpt-4o for visual analysis (PDFs, images)
- Gemini 2.0 Flash for JSON reasoning/structuring
- GPT-4o-mini fallback for text JSON
- Claude 3.5 Sonnet optional fallback for text
- Telegram Bot API (polling)
- Microsoft Graph API (Outlook)
- ExcelJS for report generation

## Development Rules
- Keep each task simple - maximum 1 feature per task
- Test immediately after each change
- Never skip error handling
- All secrets in .env file
- Database-first approach
- Focus on simplicity over complexity

## Expected Input Formats
- Email body with Spanish table format:
  ```
  DESCRIPCION COMPRA          UNIDAD/CANTIDAD    TOTAL
  ARROZ JAZMIN               Kilogramo    10    27,98 €
  HUMMUS                     Kilogramo    10    89,90 €
  ```
- PDF attachments with order data
- Telegram messages with files/links/images
- Web pages requiring scraping

## Output Format (JSON)
```json
{
  "numero_pedido": "string",
  "cliente": "string",
  "fecha_pedido": "YYYY-MM-DD",
  "canal_origen": "outlook|telegram",
  "productos": [
    {
      "nombre_producto": "string",
      "cantidad": number,
      "unidad": "string", 
      "precio_unitario": number,
      "total_producto": number
    }
  ],
  "total_pedido": number,
  "observaciones": "string"
}
```

### Canonical Code Enrichment
Additional fields may be present when hybrid matcher runs:
- `cliente_codigo_canon`: Canonical client code
- Per line item `codigo_canon`: Canonical product code
- Match metadata: `cliente_match_status`, `cliente_match_confidence`, `product_match_status`, `product_match_confidence`

## Database Schema
```sql
-- Processing logs
CREATE TABLE IF NOT EXISTS processing_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT,
  context JSONB
);

-- Orders table
CREATE TABLE pedidos (
  id SERIAL PRIMARY KEY,
  numero_pedido VARCHAR(100),
  cliente VARCHAR(300),
  fecha_pedido DATE,
  canal_origen VARCHAR(20),
  total_pedido DECIMAL(10,2),
  observaciones TEXT,
  estado VARCHAR(20) DEFAULT 'procesado',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Order products table  
CREATE TABLE pedido_productos (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
  nombre_producto VARCHAR(300),
  cantidad DECIMAL(8,2),
  unidad VARCHAR(50),
  precio_unitario DECIMAL(10,2),
  total_producto DECIMAL(10,2)
);
```

### Current DB behavior
- Duplicate detection on `pedidos.numero_pedido` before insert (returns existing if found)
- Data normalization applied pre-insert via `normalizeOrderData`
- DB-level processing logs written to `processing_logs`

### Planned: Hybrid code matching schema
Used by `CodeMatcher` (DB lookup → Gemini fuzzy match → alias auto-creation).

```sql
-- Canonical client registry
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE client_aliases (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  alias TEXT UNIQUE NOT NULL,
  metadata JSONB DEFAULT '{}'
);

-- Canonical product registry
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE product_aliases (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  alias TEXT UNIQUE NOT NULL,
  metadata JSONB DEFAULT '{}'
);
```

Notes:
- `CodeMatcher` first checks exact `code`, then `*_aliases.alias`; if no hit, it prompts Gemini to choose a best match with high confidence (>= 0.9). On AI match, an alias is inserted for faster future lookups.
- XLS export includes canonical columns: `cliente_codigo_canon`, item `codigo_canon`.

## Success Criteria
- Process 400 orders/month reliably
- <10 second processing time per order
- >95% accuracy in data extraction
- Natural language query response in <2 seconds
- Excel report generation in <5 seconds

## Environment Setup
```bash
npm install
cp .env.example .env
# Add API keys: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, OPENAI_API_KEY, GEMINI_API_KEY, TELEGRAM_BOT_TOKEN
# Optional: XLS_OUTPUT_DIR (default: Test Files Leo Output)
npm run dev
```

## Deployment Status 🚀

### Database Implementation ✅ COMPLETED
- **Supabase Project**: "Leo_orders" (eu-west-1 region)
- **Schema Status**: Complete production schema ready for deployment
- **Files**: `leo-orders-complete-schema.sql`, `LEO_ORDERS_SETUP_GUIDE.md`
- **Features**: Hybrid code matching, performance indexes, RLS security, fuzzy search

### Production Deployment ✅ READY
- **Platform**: Railway (recommended) - $36/month, Frankfurt/London regions
- **Architecture**: Containerized Node.js with auto-scaling
- **Files**: `Dockerfile`, `railway.json`, `DEPLOYMENT_GUIDE.md`, `DEPLOYMENT_COST_ANALYSIS.md`
- **CI/CD**: GitHub Actions pipeline configured
- **Monitoring**: Health checks, resource monitoring, cost tracking

### Next Steps (Manual Deployment Required)
1. **Create Supabase Project**: 
   - Go to supabase.com/dashboard
   - Create "Leo_orders" in eu-west-1 region
   - Run `leo-orders-complete-schema.sql` in SQL Editor
   
2. **Deploy to Railway**:
   - Run `./scripts/deploy.sh`
   - Configure environment variables
   - Test webhook endpoints

3. **Production Testing**:
   - Verify database connection
   - Test end-to-end order processing
   - Monitor performance metrics

## Telegram Bot Commands
- `/pedidos [filter]` - Query orders
- `/reporte` - Generate Excel report
- `/stats` - Quick statistics
- Natural language: "¿Cuántos pedidos de arroz esta semana?"

## Specialist Agent Coordination

You have access to expert specialists for this project:
- **system-architect**: Architecture decisions, technology stack, scalability planning
- **database-architect**: Database design, schema optimization, performance tuning
- **frontend-architect**: UI/UX design, React/Vue components, user experience optimization, responsive design
- **devops-specialist**: Deployment, CI/CD, infrastructure, monitoring
- **code-quality-enforcer**: Code quality, safety, best practices, use this every time there's a change in code



### Delegation Philosophy
PROACTIVELY look for opportunities where specialist expertise would provide better results:

- **Complex requests** that span multiple technical domains
- **Implementation requests** that might benefit from architectural thinking first
- **Deep technical problems** requiring domain expertise
- **Production concerns** needing operational expertise

### Agent Communication Guidelines
When delegating to specialists:
1. **Provide full context** about the Pedidos system and requirements
2. **Reference this CLAUDE.md** so they understand the project constraints
3. **Be specific** about what you need from their expertise
4. **Coordinate** when multiple specialists need to work together

Example delegation: "Use the database-architect agent to optimize our order processing queries. Here's the current schema [reference above] and our performance requirements [400 orders/month, <10s processing time]."