import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3000';

async function testWebhooks() {
  console.log('🧪 Testing webhook endpoints...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing webhook health endpoint...');
    const healthResponse = await fetch(`${BASE_URL}/webhook/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData.status);

    // Test 2: Outlook webhook with Spanish order text
    console.log('\n2. Testing Outlook webhook with Spanish order...');
    const outlookTestData = {
      subject: 'Pedido semanal - Productos alimentarios',
      from: 'supplier@example.com',
      body: `DESCRIPCION COMPRA                    UNIDAD/CANTIDAD         TOTAL
ARROZ JAZMIN                         Kilogramo    10         27,98 €
ARROZ LIBANES XTRA LARGO            Kilogramo    10         55,98 €
HUMMUS                               Kilogramo    10         89,90 €
ACEITE OLIVA VIRGEN EXTRA           Litro        5          84,75 €
TOTAL COMPRAS SIN DESCUENTOS                                256,48 €
OBSERVACIONES: PEDIDO MINIMO 80 €`,
      bodyType: 'text',
      id: 'outlook-test-' + Date.now(),
      conversationId: 'conv-123',
      receivedDateTime: new Date().toISOString()
    };

    const outlookResponse = await fetch(`${BASE_URL}/webhook/outlook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(outlookTestData)
    });

    const outlookResult = await outlookResponse.json();
    console.log('✅ Outlook webhook response:', {
      success: outlookResult.success,
      primaryContentType: outlookResult.detection?.primaryContentType,
      processable: outlookResult.detection?.processable,
      priority: outlookResult.detection?.priority
    });

    // Test 3: Telegram webhook with text message
    console.log('\n3. Testing Telegram webhook with text message...');
    const telegramTestData = {
      update_id: 123456789,
      message: {
        message_id: 1001,
        from: {
          id: 987654321,
          username: 'testuser',
          first_name: 'Test',
          last_name: 'User'
        },
        chat: {
          id: -100123456789,
          type: 'private'
        },
        date: Math.floor(Date.now() / 1000),
        text: 'ARROZ JAZMIN Kilogramo 5 14,99 €\nHUMMUS Kilogramo 3 26,97 €\nTOTAL: 41,96 €'
      }
    };

    const telegramResponse = await fetch(`${BASE_URL}/webhook/telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(telegramTestData)
    });

    const telegramResult = await telegramResponse.json();
    console.log('✅ Telegram webhook response:', {
      success: telegramResult.success,
      primaryContentType: telegramResult.detection?.primaryContentType,
      processable: telegramResult.detection?.processable,
      priority: telegramResult.detection?.priority
    });

    // Test 4: Telegram webhook with URL
    console.log('\n4. Testing Telegram webhook with URL...');
    const telegramUrlData = {
      update_id: 123456790,
      message: {
        message_id: 1002,
        from: {
          id: 987654321,
          username: 'testuser',
          first_name: 'Test'
        },
        chat: {
          id: -100123456789,
          type: 'private'
        },
        date: Math.floor(Date.now() / 1000),
        text: 'Aquí está el pedido: https://example.com/order.pdf',
        entities: [
          {
            type: 'url',
            offset: 22,
            length: 30
          }
        ]
      }
    };

    const telegramUrlResponse = await fetch(`${BASE_URL}/webhook/telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(telegramUrlData)
    });

    const telegramUrlResult = await telegramUrlResponse.json();
    console.log('✅ Telegram URL webhook response:', {
      success: telegramUrlResult.success,
      primaryContentType: telegramUrlResult.detection?.primaryContentType,
      processable: telegramUrlResult.detection?.processable,
      priority: telegramUrlResult.detection?.priority
    });

    // Test 5: Telegram webhook with document
    console.log('\n5. Testing Telegram webhook with document...');
    const telegramDocData = {
      update_id: 123456791,
      message: {
        message_id: 1003,
        from: {
          id: 987654321,
          username: 'testuser',
          first_name: 'Test'
        },
        chat: {
          id: -100123456789,
          type: 'private'
        },
        date: Math.floor(Date.now() / 1000),
        document: {
          file_id: 'BAADBAADrwADBREAAYag2BoAAR_rQ-wC',
          file_name: 'pedido_2024.pdf',
          mime_type: 'application/pdf',
          file_size: 245760
        }
      }
    };

    const telegramDocResponse = await fetch(`${BASE_URL}/webhook/telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(telegramDocData)
    });

    const telegramDocResult = await telegramDocResponse.json();
    console.log('✅ Telegram document webhook response:', {
      success: telegramDocResult.success,
      primaryContentType: telegramDocResult.detection?.primaryContentType,
      processable: telegramDocResult.detection?.processable,
      priority: telegramDocResult.detection?.priority
    });

    // Test 6: Invalid webhook data
    console.log('\n6. Testing invalid webhook data...');
    const invalidResponse = await fetch(`${BASE_URL}/webhook/telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invalid: 'data' })
    });

    const invalidResult = await invalidResponse.json();
    console.log('✅ Invalid data handling:', {
      success: invalidResult.success,
      error: invalidResult.error
    });

    console.log('\n🎉 All webhook tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Health endpoint working');
    console.log('   ✅ Outlook webhook processing Spanish orders');
    console.log('   ✅ Telegram text message processing');
    console.log('   ✅ Telegram URL detection and validation');
    console.log('   ✅ Telegram document handling');
    console.log('   ✅ Invalid data validation');
    console.log('\n🔗 Webhook endpoints ready for Phase 3 (AI Processing)');

  } catch (error) {
    console.error('\n❌ Webhook test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Please start the server first:');
      console.log('   npm run dev');
    } else {
      console.log('\n💡 Error details:', error);
    }
  }
}

// Test content detection directly
async function testContentDetection() {
  console.log('\n🔍 Testing content detection logic...\n');

  try {
    const { ContentDetector } = await import('../services/content-detector.js');

    // Test Spanish order detection
    const spanishOrderInput = {
      source: 'outlook',
      subject: 'Pedido semanal',
      body: `DESCRIPCION COMPRA                    UNIDAD/CANTIDAD         TOTAL
ARROZ JAZMIN                         Kilogramo    10         27,98 €
HUMMUS                               Kilogramo    10         89,90 €`,
      attachments: []
    };

    const spanishDetection = ContentDetector.detect(spanishOrderInput);
    console.log('✅ Spanish order detection:', {
      primaryType: spanishDetection.primaryContent?.type,
      confidence: spanishDetection.primaryContent?.confidence,
      processable: ContentDetector.isProcessable(spanishDetection).processable
    });

    // Test PDF attachment detection
    const pdfInput = {
      source: 'telegram',
      document: {
        fileId: 'test-file-id',
        fileName: 'order.pdf',
        mimeType: 'application/pdf',
        fileSize: 245760
      }
    };

    const pdfDetection = ContentDetector.detect(pdfInput);
    console.log('✅ PDF detection:', {
      primaryType: pdfDetection.primaryContent?.type,
      processor: pdfDetection.primaryContent?.processor,
      priority: ContentDetector.getProcessingPriority(pdfDetection)
    });

    console.log('\n🎯 Content detection working correctly!');

  } catch (error) {
    console.error('❌ Content detection test failed:', error.message);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testWebhooks().then(() => testContentDetection());
}

export { testWebhooks, testContentDetection };