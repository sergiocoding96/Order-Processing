// Simple mailhook test without external dependencies
import http from 'http';

const BASE_URL = 'http://localhost:3000';

// Simple HTTP POST function
function makeRequest(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({ status: res.statusCode, data: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// Test basic mailhook
async function testBasicMailhook() {
  console.log('🔧 Testing Basic Mailhook Endpoint...\n');

  const testEmail = {
    from: 'proveedor@restaurant.com',
    to: 'pedidos@mirestaurante.com',
    subject: 'Pedido Semanal - Productos Frescos',
    body: `Estimado cliente,

Adjunto el pedido semanal:

DESCRIPCION COMPRA                    UNIDAD/CANTIDAD         TOTAL
ARROZ JAZMIN                         Kilogramo    10         27,98 €
ARROZ LIBANES XTRA LARGO            Kilogramo    10         55,98 €
HUMMUS                               Kilogramo    10         89,90 €
ACEITE OLIVA VIRGEN EXTRA           Litro        5          84,75 €
TOTAL COMPRAS SIN DESCUENTOS                                256,48 €

OBSERVACIONES: PEDIDO MINIMO 80 €

Saludos,
Proveedor Alimentario`,
    messageId: 'test-basic-' + Date.now()
  };

  try {
    const response = await makeRequest(`${BASE_URL}/webhook/mailhook`, testEmail);
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
    }

    const result = response.data;
    
    console.log('✅ Basic mailhook test successful');
    console.log(`   Message ID: ${result.email?.messageId || 'N/A'}`);
    console.log(`   From: ${result.email?.from || 'N/A'}`);
    console.log(`   Subject: ${result.email?.subject || 'N/A'}`);
    console.log(`   Content Type: ${result.detection?.primaryContentType || 'N/A'}`);
    console.log(`   Processable: ${result.detection?.processable ? 'Yes' : 'No'}`);
    console.log(`   Queue ID: ${result.queueId || 'None'}`);
    console.log(`   Success: ${result.success ? 'Yes' : 'No'}`);
    
    return result;
  } catch (error) {
    console.error('❌ Basic mailhook test failed:', error.message);
    throw error;
  }
}

// Test webhook health
async function testWebhookHealth() {
  console.log('\n💗 Testing Webhook Health...\n');

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/webhook/health',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          
          console.log('✅ Health check successful');
          console.log(`   Status: ${result.status}`);
          console.log(`   Mailhook: ${result.webhooks?.mailhook || 'N/A'}`);
          console.log(`   Telegram: ${result.webhooks?.telegram || 'N/A'}`);
          console.log(`   Queue Length: ${result.queue?.queueLength || 'N/A'}`);
          console.log(`   Processing: ${result.queue?.processing ? 'Yes' : 'No'}`);
          
          resolve(result);
        } catch (e) {
          reject(new Error('Invalid JSON response: ' + body));
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Health check failed:', err.message);
      reject(err);
    });

    req.end();
  });
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Simple Mailhook Tests\n');
  console.log('='.repeat(50));

  const results = { passed: 0, failed: 0 };

  // Test 1: Health Check
  try {
    console.log('\n' + '='.repeat(20) + ' Health Check ' + '='.repeat(20));
    await testWebhookHealth();
    results.passed++;
    console.log('✅ Health Check PASSED');
  } catch (error) {
    results.failed++;
    console.log('❌ Health Check FAILED:', error.message);
  }

  // Test 2: Basic Mailhook
  try {
    console.log('\n' + '='.repeat(20) + ' Basic Mailhook ' + '='.repeat(20));
    await testBasicMailhook();
    results.passed++;
    console.log('✅ Basic Mailhook PASSED');
  } catch (error) {
    results.failed++;
    console.log('❌ Basic Mailhook FAILED:', error.message);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! Mailhook is working correctly.');
    console.log('\n📝 Mailhook Usage:');
    console.log('• Endpoint: POST http://localhost:3000/webhook/mailhook');
    console.log('• Required fields: from, subject, body');
    console.log('• Optional fields: to, messageId');
    console.log('• Health check: GET http://localhost:3000/webhook/health');
  } else {
    console.log('\n⚠️  Some tests failed. Check server logs for details.');
  }

  return results;
}

// Run if executed directly
runTests().catch(console.error);