import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const BASE_URL = 'http://localhost:3000';

// Test basic mailhook functionality
async function testBasicMailhook() {
  console.log('🔧 Testing Basic Mailhook Endpoint...\n');

  // Test simple Spanish order email
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
    const response = await fetch(`${BASE_URL}/webhook/mailhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testEmail)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('✅ Basic mailhook test successful');
    console.log(`   Message ID: ${result.email.messageId}`);
    console.log(`   From: ${result.email.from}`);
    console.log(`   Subject: ${result.email.subject}`);
    console.log(`   Content Type: ${result.detection.primaryContentType}`);
    console.log(`   Processable: ${result.detection.processable ? 'Yes' : 'No'}`);
    console.log(`   Queue ID: ${result.queueId || 'None'}`);
    
    return result;
  } catch (error) {
    console.error('❌ Basic mailhook test failed:', error.message);
    throw error;
  }
}

// Test mailhook with file attachment
async function testMailhookWithAttachment() {
  console.log('\n📎 Testing Mailhook with Attachment...\n');

  // Create a simple test PDF content
  const testPdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Test Order PDF) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000125 00000 n 
0000000230 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
324
%%EOF`;

  // Create temp directory if it doesn't exist
  const tempDir = '/tmp/mailhook-test';
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Write test PDF file
  const testPdfPath = path.join(tempDir, 'test-order.pdf');
  fs.writeFileSync(testPdfPath, testPdfContent);

  try {
    const form = new FormData();
    
    // Add email fields
    form.append('from', 'supplier@food-company.es');
    form.append('to', 'orders@restaurant.com');
    form.append('subject', 'Pedido con PDF Adjunto');
    form.append('body', 'Por favor encuentre adjunto el pedido de esta semana en formato PDF.');
    form.append('messageId', 'test-attachment-' + Date.now());
    
    // Add PDF attachment
    form.append('attachments', fs.createReadStream(testPdfPath), {
      filename: 'pedido-semanal.pdf',
      contentType: 'application/pdf'
    });

    const response = await fetch(`${BASE_URL}/webhook/mailhook`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    console.log('✅ Attachment mailhook test successful');
    console.log(`   Message ID: ${result.email.messageId}`);
    console.log(`   From: ${result.email.from}`);
    console.log(`   Subject: ${result.email.subject}`);
    console.log(`   Attachments: ${result.email.attachmentCount}`);
    console.log(`   Content Type: ${result.detection.primaryContentType}`);
    console.log(`   Processable: ${result.detection.processable ? 'Yes' : 'No'}`);
    console.log(`   Queue ID: ${result.queueId || 'None'}`);
    
    return result;
  } catch (error) {
    console.error('❌ Attachment mailhook test failed:', error.message);
    throw error;
  } finally {
    // Cleanup test file
    if (fs.existsSync(testPdfPath)) {
      fs.unlinkSync(testPdfPath);
    }
  }
}

// Test webhook health endpoint
async function testWebhookHealth() {
  console.log('\n💗 Testing Webhook Health...\n');

  try {
    const response = await fetch(`${BASE_URL}/webhook/health`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('✅ Health check successful');
    console.log(`   Status: ${result.status}`);
    console.log(`   Mailhook: ${result.webhooks.mailhook}`);
    console.log(`   Telegram: ${result.webhooks.telegram}`);
    console.log(`   Queue Length: ${result.queue.queueLength}`);
    console.log(`   Processing: ${result.queue.processing ? 'Yes' : 'No'}`);
    
    return result;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    throw error;
  }
}

// Test invalid data handling
async function testInvalidData() {
  console.log('\n⚠️  Testing Invalid Data Handling...\n');

  const invalidTests = [
    {
      name: 'Empty Request',
      data: {}
    },
    {
      name: 'Missing From Field',
      data: {
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test body'
      }
    },
    {
      name: 'Large File (should fail)',
      data: {
        from: 'test@example.com',
        subject: 'Large file test',
        body: 'Testing large file'
      },
      // We'll simulate a large file in the actual test
      simulateLargeFile: true
    }
  ];

  for (const test of invalidTests) {
    console.log(`Testing: ${test.name}`);
    
    try {
      let response;
      
      if (test.simulateLargeFile) {
        // Test with oversized file
        const form = new FormData();
        Object.entries(test.data).forEach(([key, value]) => {
          form.append(key, value);
        });
        
        // Create a buffer that's larger than the 10MB limit
        const largeBuffer = Buffer.alloc(11 * 1024 * 1024, 'a'); // 11MB
        form.append('attachments', largeBuffer, {
          filename: 'large-file.txt',
          contentType: 'text/plain'
        });
        
        response = await fetch(`${BASE_URL}/webhook/mailhook`, {
          method: 'POST',
          body: form,
          headers: form.getHeaders()
        });
      } else {
        response = await fetch(`${BASE_URL}/webhook/mailhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(test.data)
        });
      }

      const result = await response.json();
      
      if (response.ok) {
        console.log(`   ⚠️  Unexpectedly succeeded: ${result.message}`);
      } else {
        console.log(`   ✅ Correctly failed: ${result.error}`);
      }
      
    } catch (error) {
      console.log(`   ✅ Correctly failed: ${error.message}`);
    }
  }
}

// Main test function
async function runMailhookTests() {
  console.log('🚀 Starting Mailhook Integration Tests\n');
  console.log('=' * 50);

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const tests = [
    { name: 'Basic Mailhook', fn: testBasicMailhook },
    { name: 'Webhook Health', fn: testWebhookHealth },
    { name: 'Mailhook with Attachment', fn: testMailhookWithAttachment },
    { name: 'Invalid Data Handling', fn: testInvalidData }
  ];

  for (const test of tests) {
    try {
      console.log(`\n${'='.repeat(20)} ${test.name} ${'='.repeat(20)}`);
      const result = await test.fn();
      results.passed++;
      results.tests.push({ name: test.name, status: 'PASSED', result });
      console.log(`✅ ${test.name} PASSED`);
    } catch (error) {
      results.failed++;
      results.tests.push({ name: test.name, status: 'FAILED', error: error.message });
      console.log(`❌ ${test.name} FAILED: ${error.message}`);
    }
  }

  // Generate summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! Mailhook is ready for use.');
    console.log('\n📝 Usage Instructions:');
    console.log('1. POST emails to: http://localhost:3000/webhook/mailhook');
    console.log('2. Include fields: from, to, subject, body, messageId (optional)');
    console.log('3. Attach files using multipart/form-data with "attachments" field');
    console.log('4. Check health: GET http://localhost:3000/webhook/health');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
  }

  return results;
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMailhookTests().catch(console.error);
}

export { runMailhookTests, testBasicMailhook, testMailhookWithAttachment };