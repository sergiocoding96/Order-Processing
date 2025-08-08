# Pedidos Automation System

## Project Overview
Multi-channel order processing system that extracts data from emails/Telegram and provides conversational interface for 400 orders/month.

## Tech Stack
- Node.js + Express.js
- Supabase (PostgreSQL)
- GPT-4 Vision for visual analysis (PDFs, images)
- DeepSeek R1 for conversational agent and text processing
- Claude 3.5 Sonnet as fallback for text processing
- Telegram Bot API
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

## Database Schema
```sql
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
# Add API keys: SUPABASE_URL, OPENAI_API_KEY, DEEPSEEK_API_KEY, ANTHROPIC_API_KEY (fallback), TELEGRAM_BOT_TOKEN
npm run dev
```

## Telegram Bot Commands
- `/pedidos [filter]` - Query orders
- `/reporte` - Generate Excel report
- `/stats` - Quick statistics
- Natural language: "¿Cuántos pedidos de arroz esta semana?"