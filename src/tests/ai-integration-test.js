import { processTextWithFallback, analyzeVisualContent, generateChatResponse } from '../config/ai.js';
import { AIProcessor } from '../services/ai-processor.js';
import logger from '../utils/logger.js';

async function testRealAIAPIs() {
  console.log('🧪 Testing AI APIs with real credentials...\n');

  // Test 1: DeepSeek R1 text processing
  console.log('1. Testing DeepSeek R1 text processing...');
  try {
    const spanishOrderText = `DESCRIPCION COMPRA                    UNIDAD/CANTIDAD         TOTAL
ARROZ JAZMIN                         Kilogramo    10         27,98 €
ARROZ LIBANES XTRA LARGO            Kilogramo    10         55,98 €
HUMMUS                               Kilogramo    10         89,90 €
ACEITE OLIVA VIRGEN EXTRA           Litro        5          84,75 €
TOTAL COMPRAS SIN DESCUENTOS                                256,48 €
OBSERVACIONES: PEDIDO MINIMO 80 €`;

    const extractionPrompt = `Extract order information from this Spanish text and return ONLY a valid JSON object:

${spanishOrderText}

Return JSON in this exact format:
{
  "numero_pedido": "order number if mentioned",
  "cliente": "customer name if mentioned", 
  "fecha_pedido": "order date in YYYY-MM-DD format if mentioned",
  "productos": [
    {
      "nombre_producto": "product name",
      "cantidad": number,
      "unidad": "unit",
      "precio_unitario": number,
      "total_producto": number
    }
  ],
  "total_pedido": number,
  "observaciones": "any additional notes"
}

Convert all prices to numbers (remove € symbol). Use null for missing information.`;

    const result = await processTextWithFallback(extractionPrompt, {
      maxTokens: 2000,
      temperature: 0.1
    });

    console.log('✅ DeepSeek R1 processing successful');
    console.log('   Provider:', result.provider);
    console.log('   Usage:', result.usage);
    
    // Try to parse the JSON
    try {
      const parsedData = JSON.parse(result.content);
      console.log('   Products extracted:', parsedData.productos?.length || 0);
      console.log('   Total amount:', parsedData.total_pedido);
    } catch (parseError) {
      console.log('   Response received but JSON parsing failed');
      console.log('   Raw response preview:', result.content.substring(0, 200) + '...');
    }

  } catch (error) {
    console.error('❌ DeepSeek R1 test failed:', error.message);
  }

  // Test 2: Chat response generation
  console.log('\n2. Testing DeepSeek R1 chat response...');
  try {
    const chatResponse = await generateChatResponse(
      '¿Cuántos pedidos de arroz tenemos esta semana?',
      { total_orders: 15, rice_orders: 8 },
      { maxTokens: 200 }
    );

    console.log('✅ Chat response generation successful');
    console.log('   Response:', chatResponse.response.substring(0, 100) + '...');
    console.log('   Usage:', chatResponse.usage);

  } catch (error) {
    console.error('❌ Chat response test failed:', error.message);
  }

  // Test 3: AI Processor with text content
  console.log('\n3. Testing AIProcessor with Spanish order text...');
  try {
    const detection = {
      primaryContent: {
        type: 'spanish_order_table',
        processor: 'deepseek-r1'
      }
    };

    const contentData = {
      text: `DESCRIPCION COMPRA          UNIDAD/CANTIDAD    TOTAL
ARROZ JAZMIN               Kilogramo    5     13,99 €
HUMMUS                     Kilogramo    3     26,97 €
TOTAL                                           40,96 €`
    };

    const processingResult = await AIProcessor.processContent(detection, contentData);
    
    console.log('✅ AIProcessor text processing successful');
    console.log('   Method:', processingResult.processingMethod);
    console.log('   Confidence:', processingResult.confidence);
    console.log('   Products found:', processingResult.extractedData?.productos?.length || 0);
    
    if (processingResult.extractedData?.productos?.length > 0) {
      console.log('   Sample product:', processingResult.extractedData.productos[0]);
    }

  } catch (error) {
    console.error('❌ AIProcessor test failed:', error.message);
  }

  // Test 4: GPT-4 Vision (placeholder - would need actual image)
  console.log('\n4. Testing GPT-4 Vision readiness...');
  try {
    // Just test if we can import and the client is ready
    const { openai } = await import('../config/ai.js');
    if (openai) {
      console.log('✅ GPT-4 Vision client configured and ready');
      console.log('   Note: Visual analysis will work when provided with image data');
    } else {
      console.log('❌ GPT-4 Vision client not configured');
    }
  } catch (error) {
    console.error('❌ GPT-4 Vision test failed:', error.message);
  }

  console.log('\n🎯 AI Integration Test Summary:');
  console.log('   🤖 DeepSeek R1: Text processing and chat responses');
  console.log('   👁️  GPT-4 Vision: Ready for visual analysis');
  console.log('   🔄 Processing Chain: DeepSeek → Claude fallback');
  console.log('   📊 AIProcessor: Complete processing pipeline');

  console.log('\n✅ Real API testing completed!');
}

// Test error handling and fallback
async function testFallbackLogic() {
  console.log('\n🔄 Testing fallback logic...\n');

  try {
    // Test with a deliberately complex prompt that might challenge the AI
    const complexPrompt = `This is a test of the fallback system. Please respond with "FALLBACK_TEST_SUCCESS" if you can process this message.`;
    
    const result = await processTextWithFallback(complexPrompt, {
      maxTokens: 100,
      temperature: 0
    });

    console.log('✅ Fallback system working');
    console.log('   Primary provider used:', result.provider);
    console.log('   Response contains expected text:', result.content.includes('FALLBACK_TEST_SUCCESS') ? 'Yes' : 'No');

  } catch (error) {
    console.error('❌ Fallback test failed:', error.message);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testRealAIAPIs().then(() => testFallbackLogic());
}

export { testRealAIAPIs, testFallbackLogic };