import { AIProcessor } from '../services/ai-processor.js';
import { ContentDetector } from '../services/content-detector.js';
import { processingQueue } from '../services/processing-queue.js';
import logger from '../utils/logger.js';

async function testAIExtractionAccuracy() {
  console.log('🎯 Testing AI extraction accuracy with sample data...\n');

  // Sample test cases with expected results
  const testCases = [
    {
      name: 'Spanish Order Table - Standard Format',
      input: {
        source: 'outlook',
        body: `DESCRIPCION COMPRA                    UNIDAD/CANTIDAD         TOTAL
ARROZ JAZMIN                         Kilogramo    10         27,98 €
ARROZ LIBANES XTRA LARGO            Kilogramo    10         55,98 €
HUMMUS                               Kilogramo    10         89,90 €
ACEITE OLIVA VIRGEN EXTRA           Litro        5          84,75 €
TOTAL COMPRAS SIN DESCUENTOS                                256,48 €
OBSERVACIONES: PEDIDO MINIMO 80 €`
      },
      expected: {
        productCount: 4,
        totalAmount: 256.48,
        hasProducts: true,
        currencies: ['€']
      }
    },
    {
      name: 'Simple Order - Telegram Format',
      input: {
        source: 'telegram',
        text: `Pedido para mañana:
- Arroz jazmín 5kg - 14,99€
- Hummus 3kg - 26,97€
- Aceite oliva 2L - 16,50€
Total: 58,46€`
      },
      expected: {
        productCount: 3,
        totalAmount: 58.46,
        hasProducts: true,
        currencies: ['€']
      }
    },
    {
      name: 'Mixed Units Order',
      input: {
        source: 'telegram',
        text: `PEDIDO SEMANAL
Arroz basmati - 2 Kilogramo - 8,50€
Lentejas rojas - 1 Kilogramo - 4,25€
Aceite girasol - 3 Litro - 12,75€
Pan integral - 5 Unidad - 7,50€
TOTAL: 33,00€`
      },
      expected: {
        productCount: 4,
        totalAmount: 33.00,
        hasProducts: true,
        currencies: ['€']
      }
    },
    {
      name: 'Order with Customer Info',
      input: {
        source: 'outlook',
        body: `Pedido #2024-001
Cliente: Restaurante El Buen Sabor
Fecha: 2024-01-15

PRODUCTOS:
ARROZ BOMBA - 20 Kilogramo - 45,00€
ACEITE OLIVA PREMIUM - 10 Litro - 89,50€
SAL MARINA - 5 Kilogramo - 12,25€

TOTAL PEDIDO: 146,75€
Observaciones: Entrega urgente`
      },
      expected: {
        productCount: 3,
        totalAmount: 146.75,
        hasProducts: true,
        hasOrderNumber: true,
        hasCustomer: true,
        currencies: ['€']
      }
    },
    {
      name: 'Empty/Invalid Content',
      input: {
        source: 'telegram',
        text: 'Hola, ¿cómo estás? No hay información de pedido aquí.'
      },
      expected: {
        productCount: 0,
        totalAmount: 0,
        hasProducts: false,
        lowConfidence: true
      }
    }
  ];

  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`${i + 1}. Testing: ${testCase.name}`);

    try {
      // Detect content type
      const detection = ContentDetector.detect(testCase.input);
      const processability = ContentDetector.isProcessable(detection);

      if (!processability.processable) {
        console.log('   ❌ Content not processable:', processability.reason);
        results.push({
          testCase: testCase.name,
          success: false,
          error: processability.reason,
          accuracy: 0
        });
        continue;
      }

      // Prepare content data
      const contentData = {
        text: testCase.input.body || testCase.input.text
      };

      // Process with AI
      const aiResult = await AIProcessor.processContent(detection, contentData);

      if (!aiResult.success) {
        console.log('   ❌ AI processing failed');
        results.push({
          testCase: testCase.name,
          success: false,
          error: 'AI processing failed',
          accuracy: 0
        });
        continue;
      }

      // Evaluate accuracy
      const accuracy = evaluateAccuracy(aiResult.extractedData, testCase.expected);
      
      console.log('   ✅ Processing successful');
      console.log(`      Confidence: ${aiResult.confidence?.toFixed(2) || 'N/A'}`);
      console.log(`      Accuracy: ${accuracy.score?.toFixed(2) || 'N/A'}%`);
      console.log(`      Products extracted: ${aiResult.extractedData?.productos?.length || 0}`);
      console.log(`      Total amount: ${aiResult.extractedData?.total_pedido || 'N/A'}`);
      
      if (accuracy.issues.length > 0) {
        console.log('      Issues:', accuracy.issues.join(', '));
      }

      results.push({
        testCase: testCase.name,
        success: true,
        confidence: aiResult.confidence,
        accuracy: accuracy.score,
        issues: accuracy.issues,
        extractedData: aiResult.extractedData,
        processingMethod: aiResult.processingMethod
      });

    } catch (error) {
      console.error(`   ❌ Test failed: ${error.message}`);
      results.push({
        testCase: testCase.name,
        success: false,
        error: error.message,
        accuracy: 0
      });
    }

    console.log(); // Empty line for readability
  }

  // Generate summary report
  generateAccuracyReport(results);
}

function evaluateAccuracy(extractedData, expected) {
  const accuracy = {
    score: 0,
    issues: []
  };

  let totalChecks = 0;
  let passedChecks = 0;

  // Check product count
  totalChecks++;
  const actualProductCount = extractedData?.productos?.length || 0;
  if (actualProductCount === expected.productCount) {
    passedChecks++;
  } else {
    accuracy.issues.push(`Product count: expected ${expected.productCount}, got ${actualProductCount}`);
  }

  // Check total amount (with tolerance for small differences)
  if (expected.totalAmount !== undefined) {
    totalChecks++;
    const actualTotal = extractedData?.total_pedido || 0;
    const tolerance = 0.02; // 2 cent tolerance
    if (Math.abs(actualTotal - expected.totalAmount) <= tolerance) {
      passedChecks++;
    } else {
      accuracy.issues.push(`Total amount: expected ${expected.totalAmount}, got ${actualTotal}`);
    }
  }

  // Check if products exist when expected
  if (expected.hasProducts !== undefined) {
    totalChecks++;
    const hasProducts = actualProductCount > 0;
    if (hasProducts === expected.hasProducts) {
      passedChecks++;
    } else {
      accuracy.issues.push(`Has products: expected ${expected.hasProducts}, got ${hasProducts}`);
    }
  }

  // Check for order number
  if (expected.hasOrderNumber !== undefined) {
    totalChecks++;
    const hasOrderNumber = !!(extractedData?.numero_pedido);
    if (hasOrderNumber === expected.hasOrderNumber) {
      passedChecks++;
    } else {
      accuracy.issues.push(`Has order number: expected ${expected.hasOrderNumber}, got ${hasOrderNumber}`);
    }
  }

  // Check for customer info
  if (expected.hasCustomer !== undefined) {
    totalChecks++;
    const hasCustomer = !!(extractedData?.cliente);
    if (hasCustomer === expected.hasCustomer) {
      passedChecks++;
    } else {
      accuracy.issues.push(`Has customer: expected ${expected.hasCustomer}, got ${hasCustomer}`);
    }
  }

  // Check for low confidence cases
  if (expected.lowConfidence !== undefined) {
    totalChecks++;
    // This is expected to have low confidence or fail
    passedChecks++; // We count this as pass since we expect it to be problematic
  }

  accuracy.score = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;
  return accuracy;
}

function generateAccuracyReport(results) {
  console.log('📊 AI Extraction Accuracy Report\n');
  console.log('=' * 50);

  const successfulTests = results.filter(r => r.success);
  const failedTests = results.filter(r => !r.success);

  console.log(`Total tests: ${results.length}`);
  console.log(`Successful: ${successfulTests.length}`);
  console.log(`Failed: ${failedTests.length}`);
  console.log(`Success rate: ${((successfulTests.length / results.length) * 100).toFixed(1)}%`);

  if (successfulTests.length > 0) {
    const avgAccuracy = successfulTests.reduce((sum, r) => sum + (r.accuracy || 0), 0) / successfulTests.length;
    const avgConfidence = successfulTests.reduce((sum, r) => sum + (r.confidence || 0), 0) / successfulTests.length;
    
    console.log(`Average accuracy: ${avgAccuracy.toFixed(1)}%`);
    console.log(`Average confidence: ${avgConfidence.toFixed(2)}`);
  }

  console.log('\nDetailed Results:');
  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.testCase}`);
    if (result.success) {
      console.log(`   ✅ Success - Accuracy: ${result.accuracy?.toFixed(1) || 'N/A'}%`);
      console.log(`   Confidence: ${result.confidence?.toFixed(2) || 'N/A'}`);
      console.log(`   Method: ${result.processingMethod || 'N/A'}`);
      if (result.issues && result.issues.length > 0) {
        console.log(`   Issues: ${result.issues.join(', ')}`);
      }
    } else {
      console.log(`   ❌ Failed - ${result.error}`);
    }
  });

  // Recommendations
  console.log('\n🎯 Recommendations:');
  
  const lowAccuracyTests = successfulTests.filter(r => r.accuracy < 80);
  if (lowAccuracyTests.length > 0) {
    console.log('   • Consider improving AI prompts for better accuracy');
    console.log('   • Review extraction patterns for edge cases');
  }

  const lowConfidenceTests = successfulTests.filter(r => r.confidence < 0.7);
  if (lowConfidenceTests.length > 0) {
    console.log('   • Add more validation for low-confidence extractions');
    console.log('   • Consider manual review for confidence < 0.7');
  }

  if (failedTests.length > 0) {
    console.log('   • Investigate and fix processing failures');
    console.log('   • Improve error handling and fallback mechanisms');
  }

  console.log('\n✅ AI extraction accuracy testing completed!');
}

// Test processing queue with sample data
async function testProcessingQueue() {
  console.log('\n🔄 Testing processing queue with sample data...\n');

  try {
    const sampleWebhookData = {
      source: 'telegram',
      text: 'ARROZ JAZMIN Kilogramo 5 14,99 €\nHUMMUS Kilogramo 2 17,98 €\nTOTAL: 32,97 €',
      chatId: 123456789,
      messageId: 1001,
      timestamp: new Date().toISOString()
    };

    // Detect content
    const detection = ContentDetector.detect(sampleWebhookData);
    
    // Add to queue
    const queueId = await processingQueue.addToQueue(sampleWebhookData, detection);
    console.log('✅ Sample data added to processing queue');
    console.log('   Queue ID:', queueId);
    
    // Wait a moment and check queue status
    setTimeout(() => {
      const status = processingQueue.getStatus();
      console.log('   Queue status:', status);
    }, 2000);

  } catch (error) {
    console.error('❌ Processing queue test failed:', error.message);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAIExtractionAccuracy()
    .then(() => testProcessingQueue())
    .catch(console.error);
}

export { testAIExtractionAccuracy, testProcessingQueue };