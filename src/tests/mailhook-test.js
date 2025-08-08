import { MailhookProcessor } from '../services/mailhook-processor.js';
import logger from '../utils/logger.js';

const BASE_URL = 'http://localhost:3000';

async function testMailhookIntegration() {
  console.log('📧 Testing Mailhook Integration...\n');

  // Test different mailhook provider formats
  const testCases = [
    {
      name: 'Mailgun Format - Spanish Order',
      provider: 'mailgun',
      data: {
        'Message-Id': '<mailgun-test-123@example.com>',
        'sender': 'supplier@restaurant.com',
        'recipient': 'orders@mycompany.com',
        'subject': 'Pedido Semanal - Productos Frescos',
        'body-plain': `Estimado cliente,

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
        'timestamp': Math.floor(Date.now() / 1000).toString(),
        'signature': 'test-signature',
        'token': 'test-token'
      }
    },
    {
      name: 'SendGrid Format - Simple Order',
      provider: 'sendgrid',
      data: {
        'from': { 'email': 'orders@supplier.es', 'name': 'Proveedor Principal' },
        'to': { 'email': 'pedidos@restaurant.com' },
        'subject': 'Pedido Urgente',
        'text': `Pedido para entrega mañana:

- Arroz basmati 5kg - 24,50€
- Lentejas rojas 3kg - 12,75€  
- Aceite girasol 2L - 8,90€
- Pan integral 10 unidades - 15,00€

Total pedido: 61,15€

Confirmar recepción por favor.`,
        'envelope': {
          'messageId': 'sendgrid-test-456'
        }
      }
    },
    {
      name: 'Postmark Format - Customer Order',
      provider: 'postmark',
      data: {
        'MessageID': 'postmark-test-789',
        'From': 'cliente@restaurant-madrid.com',
        'To': 'ventas@distribuidor.es',
        'Subject': 'Pedido #2024-001 - Restaurante Madrid',
        'TextBody': `Pedido número: 2024-001
Cliente: Restaurante Madrid
Fecha: 2024-01-15

PRODUCTOS SOLICITADOS:
ARROZ BOMBA - 20 Kilogramo - 45,00€
ACEITE OLIVA PREMIUM - 10 Litro - 89,50€
SAL MARINA GRUESA - 5 Kilogramo - 12,25€
VINAGRE JEREZ - 3 Litro - 27,75€

TOTAL PEDIDO: 174,50€

Observaciones: Entrega antes de las 10:00h
Dirección: Calle Mayor 123, Madrid`,
        'Date': new Date().toISOString()
      }
    },
    {
      name: 'Generic Format - Mixed Content',
      provider: 'generic',
      data: {
        'from': 'info@proveedor-online.com',
        'to': 'compras@mirestaurante.com',
        'subject': 'Confirmación Pedido Online',
        'body': `Gracias por su pedido online.

Productos:
• Arroz integral ecológico - 8 unidades - 32,00€
• Quinoa premium - 4 unidades - 28,00€
• Aceite coco virgen - 6 unidades - 45,00€

Subtotal: 105,00€
Envío: Gratuito
TOTAL: 105,00€

Tiempo estimado de entrega: 24-48h`,
        'messageId': 'generic-test-999'
      }
    }
  ];

  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`${i + 1}. Testing: ${testCase.name}`);

    try {
      // Test mailhook processing
      const processed = MailhookProcessor.processMailhook(testCase.data);
      
      console.log('   ✅ Mailhook processing successful');
      console.log(`      Provider detected: ${processed.provider}`);
      console.log(`      From: ${processed.from}`);
      console.log(`      Subject: ${processed.subject}`);
      console.log(`      Body length: ${processed.body?.length || 0} chars`);

      // Test API endpoint
      const response = await fetch(`${BASE_URL}/webhook/mailhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.data)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log('   ✅ API endpoint successful');
      console.log(`      Queue ID: ${result.queueId || 'None'}`);
      console.log(`      Content Type: ${result.detection?.primaryContentType || 'Unknown'}`);
      console.log(`      Processable: ${result.detection?.processable ? 'Yes' : 'No'}`);

      results.push({
        testCase: testCase.name,
        provider: testCase.provider,
        success: true,
        processed: processed,
        apiResult: result
      });

    } catch (error) {
      console.error(`   ❌ Test failed: ${error.message}`);
      results.push({
        testCase: testCase.name,
        provider: testCase.provider,
        success: false,
        error: error.message
      });
    }

    console.log(); // Empty line for readability
  }

  // Generate summary report
  generateMailhookReport(results);
}

function generateMailhookReport(results) {
  console.log('📊 Mailhook Integration Report\n');
  console.log('=' * 50);

  const successfulTests = results.filter(r => r.success);
  const failedTests = results.filter(r => !r.success);

  console.log(`Total tests: ${results.length}`);
  console.log(`Successful: ${successfulTests.length}`);
  console.log(`Failed: ${failedTests.length}`);
  console.log(`Success rate: ${((successfulTests.length / results.length) * 100).toFixed(1)}%`);

  // Provider breakdown
  console.log('\n📧 Provider Support:');
  const providerStats = {};
  results.forEach(result => {
    if (!providerStats[result.provider]) {
      providerStats[result.provider] = { total: 0, successful: 0 };
    }
    providerStats[result.provider].total++;
    if (result.success) {
      providerStats[result.provider].successful++;
    }
  });

  Object.entries(providerStats).forEach(([provider, stats]) => {
    const rate = ((stats.successful / stats.total) * 100).toFixed(1);
    console.log(`   ${provider}: ${stats.successful}/${stats.total} (${rate}%)`);
  });

  // Content detection analysis
  console.log('\n🎯 Content Detection:');
  const processableCount = successfulTests.filter(r => 
    r.apiResult?.detection?.processable
  ).length;
  
  console.log(`   Processable content: ${processableCount}/${successfulTests.length}`);
  console.log(`   Detection rate: ${((processableCount / successfulTests.length) * 100).toFixed(1)}%`);

  // Individual results
  console.log('\n📋 Detailed Results:');
  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.testCase} (${result.provider})`);
    if (result.success) {
      console.log(`   ✅ Success`);
      console.log(`   From: ${result.processed.from}`);
      console.log(`   Content Type: ${result.apiResult.detection?.primaryContentType || 'N/A'}`);
      console.log(`   Processable: ${result.apiResult.detection?.processable ? 'Yes' : 'No'}`);
      if (result.apiResult.queueId) {
        console.log(`   Queued: ${result.apiResult.queueId}`);
      }
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
    }
  });

  console.log('\n🎯 Recommendations:');
  
  if (failedTests.length > 0) {
    console.log('   • Investigate and fix processing failures');
    console.log('   • Check server connectivity and API keys');
  }

  if (processableCount < successfulTests.length) {
    console.log('   • Review content detection patterns for better accuracy');
    console.log('   • Consider adding more Spanish order format recognition');
  }

  console.log('\n✅ Mailhook integration testing completed!');
}

// Test mailhook validation
async function testMailhookValidation() {
  console.log('\n🔍 Testing Mailhook Validation...\n');

  const validationTests = [
    {
      name: 'Valid Mailgun',
      data: {
        'sender': 'test@example.com',
        'subject': 'Test Subject',
        'body-plain': 'Test body'
      },
      expectedValid: true
    },
    {
      name: 'Missing From Field',
      data: {
        'subject': 'Test Subject',
        'body-plain': 'Test body'
      },
      expectedValid: false
    },
    {
      name: 'Valid SendGrid',
      data: {
        'from': { 'email': 'test@example.com' },
        'subject': 'Test Subject',
        'text': 'Test body'
      },
      expectedValid: true
    }
  ];

  validationTests.forEach((test, index) => {
    console.log(`${index + 1}. ${test.name}`);
    
    const validation = MailhookProcessor.validateMailhookRequest(test.data);
    const passed = validation.valid === test.expectedValid;
    
    console.log(`   ${passed ? '✅' : '❌'} ${validation.valid ? 'Valid' : 'Invalid'}`);
    if (!validation.valid && validation.errors.length > 0) {
      console.log(`   Errors: ${validation.errors.join(', ')}`);
    }
    console.log(`   Provider: ${validation.provider}`);
  });
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testMailhookIntegration()
    .then(() => testMailhookValidation())
    .catch(console.error);
}

export { testMailhookIntegration, testMailhookValidation };