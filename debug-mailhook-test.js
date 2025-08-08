// Debug version of the mailhook test to see what's happening
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

// Test basic mailhook with debugging
async function debugBasicMailhook() {
  console.log('🔧 Debug: Testing Basic Mailhook Endpoint...\n');

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
    messageId: 'debug-test-' + Date.now()
  };

  console.log('📤 Sending email data:');
  console.log('   From:', testEmail.from);
  console.log('   Subject:', testEmail.subject);
  console.log('   Body length:', testEmail.body.length, 'chars');
  console.log('   Spanish patterns in body:');
  console.log('     - DESCRIPCION COMPRA:', testEmail.body.includes('DESCRIPCION COMPRA'));
  console.log('     - UNIDAD/CANTIDAD:', testEmail.body.includes('UNIDAD/CANTIDAD'));
  console.log('     - Euro symbol (€):', testEmail.body.includes('€'));
  console.log('     - Kilogramo:', testEmail.body.includes('Kilogramo'));
  console.log('     - Litro:', testEmail.body.includes('Litro'));
  console.log('     - OBSERVACIONES:', testEmail.body.includes('OBSERVACIONES'));

  try {
    const response = await makeRequest(`${BASE_URL}/webhook/mailhook`, testEmail);
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
    }

    const result = response.data;
    
    console.log('\n📥 Response received:');
    console.log('   Success:', result.success);
    console.log('   Message ID:', result.email?.messageId || 'N/A');
    console.log('   From:', result.email?.from || 'N/A');
    console.log('   Subject:', result.email?.subject || 'N/A');
    console.log('   Attachment Count:', result.email?.attachmentCount || 0);
    
    console.log('\n🔍 Detection Results:');
    console.log('   Primary Content Type:', result.detection?.primaryContentType || 'N/A');
    console.log('   Processable:', result.detection?.processable ? 'Yes' : 'No');
    console.log('   Priority:', result.detection?.priority || 'N/A');
    
    if (result.detection?.processable === false) {
      console.log('   Reason not processable:', result.warning || 'Unknown');
    }
    
    console.log('   Queue ID:', result.queueId || 'None');
    
    // Print full detection object for debugging
    console.log('\n🔬 Full Detection Object:');
    console.log(JSON.stringify(result.detection, null, 2));
    
    return result;
  } catch (error) {
    console.error('❌ Debug mailhook test failed:', error.message);
    throw error;
  }
}

// Run debug test
debugBasicMailhook().catch(console.error);