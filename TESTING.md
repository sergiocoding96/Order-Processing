# 🧪 Testing the Pedidos Automation System

## Quick Test Options

### 1. 🚀 **Start the Server**
```bash
cd "/Users/sergiopalacio/Projects/Order Processing"
npm run dev
```
The server will start on http://localhost:3000

### 2. 🏥 **Health Check Test**
```bash
# Test if server is running
curl http://localhost:3000/health

# Test webhook health
curl http://localhost:3000/webhook/health
```

### 3. 🤖 **AI Processing Test (Simple)**
```bash
# Test AI extraction with Spanish order
curl -X POST http://localhost:3000/webhook/telegram \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 123,
    "message": {
      "message_id": 1,
      "from": {"id": 123, "username": "test"},
      "chat": {"id": 456, "type": "private"},
      "date": 1234567890,
      "text": "ARROZ JAZMIN Kilogramo 5 14,99 €\nHUMMUS Kilogramo 3 26,97 €\nTOTAL: 41,96 €"
    }
  }'
```

### 4. 📧 **Outlook Webhook Test**
```bash
# Test Outlook webhook with Spanish order table
curl -X POST http://localhost:3000/webhook/outlook \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Pedido semanal",
    "from": "supplier@example.com",
    "body": "DESCRIPCION COMPRA          UNIDAD/CANTIDAD    TOTAL\nARROZ JAZMIN               Kilogramo    10    27,98 €\nHUMMUS                     Kilogramo    10    89,90 €\nTOTAL COMPRAS                                   117,88 €",
    "id": "test-message-123"
  }'
```

## 🔬 **Advanced Testing Scripts**

### 5. **Run Built-in Test Suite**
```bash
# Test AI configuration
node src/tests/ai-test.js

# Test AI extraction accuracy (takes 2-3 minutes)
node src/tests/ai-extraction-test.js

# Test database connection (requires Supabase setup)
node src/tests/database-test.js

# Test webhook functionality
node src/tests/webhook-test.js
```

### 6. **Queue Status Monitoring**
```bash
# Check processing queue status
curl http://localhost:3000/webhook/queue/status
```

## 📊 **Expected Test Results**

### ✅ **Successful Webhook Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "queueId": "queue_1733434567890_abc123",
  "detection": {
    "primaryContentType": "spanish_order_table",
    "processable": true,
    "priority": 1
  }
}
```

### ✅ **AI Processing Success (in logs):**
```
✅ DeepSeek R1 processing successful
   Products found: 2
   Total amount: 41.96
   Confidence: 0.9
```

## 🐛 **Troubleshooting Common Issues**

### **Issue 1: "AI service configuration error"**
- **Cause**: Missing or invalid API keys
- **Fix**: Check your `.env` file has:
  ```
  OPENAI_API_KEY=sk-proj-...
  DEEPSEEK_API_KEY=sk-...
  ```

### **Issue 2: "Database connection failed"**
- **Cause**: Missing Supabase configuration
- **Fix**: Add Supabase credentials to `.env`:
  ```
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_ANON_KEY=your-anon-key
  SUPABASE_SERVICE_KEY=your-service-key
  ```

### **Issue 3: "Content not processable"**
- **Cause**: Content doesn't match Spanish order patterns
- **Expected**: This is normal for non-order content
- **Test with**: Spanish order format with € symbols

## 🎯 **Real-World Test Scenarios**

### **Scenario A: Email Order**
Copy-paste this into an email and send to your webhook:
```
DESCRIPCION COMPRA                    UNIDAD/CANTIDAD         TOTAL
ARROZ JAZMIN                         Kilogramo    10         27,98 €
ARROZ LIBANES XTRA LARGO            Kilogramo    10         55,98 €
HUMMUS                               Kilogramo    10         89,90 €
ACEITE OLIVA VIRGEN EXTRA           Litro        5          84,75 €
TOTAL COMPRAS SIN DESCUENTOS                                256,48 €
OBSERVACIONES: PEDIDO MINIMO 80 €
```

### **Scenario B: Telegram Message**
Send this to your Telegram bot:
```
Pedido para mañana:
- Arroz basmati 2kg - 8,50€
- Lentejas rojas 1kg - 4,25€
- Aceite girasol 3L - 12,75€
Total: 25,50€
```

### **Scenario C: Mixed Format**
```
PEDIDO #2024-001
Cliente: Restaurante Los Sabores
Fecha: 2024-01-15

PRODUCTOS:
ARROZ BOMBA - 20 Kilogramo - 45,00€
ACEITE OLIVA PREMIUM - 10 Litro - 89,50€
SAL MARINA - 5 Kilogramo - 12,25€

TOTAL PEDIDO: 146,75€
```

## 📈 **Performance Monitoring**

### **Check Processing Times**
Watch the logs for timing information:
```bash
# In another terminal, watch logs
tail -f logs/combined.log
```

### **Monitor Queue Performance**
```bash
# Check queue status every 5 seconds
watch -n 5 'curl -s http://localhost:3000/webhook/queue/status | jq'
```

## 🎮 **Interactive Test Dashboard**

Create a simple test dashboard by visiting:
- http://localhost:3000/health (Health status)
- http://localhost:3000/webhook/health (Webhook status)
- http://localhost:3000/webhook/queue/status (Queue status)

## 🔄 **Next Steps After Testing**

1. **If tests pass**: Ready for Phase 4 (Database Operations)
2. **If issues found**: We'll debug and fix them
3. **For production**: Set up real Supabase database and Telegram bot

## 📝 **Test Results Template**

Document your test results:
```
Test Date: ___________
Server Status: ✅/❌
Webhook Response: ✅/❌
AI Processing: ✅/❌
Queue System: ✅/❌
Extraction Accuracy: ____%
Processing Time: _____ seconds
Issues Found: ___________
```