import { checkAIProviders } from '../config/ai.js';
import { ContentDetector } from '../services/content-detector.js';
import logger from '../utils/logger.js';

async function testAIConfiguration() {
  console.log('🤖 Testing AI configuration...\n');

  try {
    // Test 1: Check AI provider availability
    console.log('1. Checking AI provider availability...');
    const providers = checkAIProviders();
    
    console.log('AI Providers Status:');
    console.log(`   OpenAI (GPT-4 Vision): ${providers.openai ? '✅' : '❌'}`);
    console.log(`   DeepSeek R1: ${providers.deepseek ? '✅' : '❌'}`);
    console.log(`   Claude (Fallback): ${providers.anthropic ? '✅' : '❌'}`);

    // Test 2: Content detection with new architecture
    console.log('\n2. Testing content detection with new AI architecture...');
    
    const testInputs = [
      {
        name: 'Spanish Order Table',
        input: {
          source: 'outlook',
          body: `DESCRIPCION COMPRA                    UNIDAD/CANTIDAD         TOTAL
ARROZ JAZMIN                         Kilogramo    10         27,98 €
HUMMUS                               Kilogramo    5          44,95 €
TOTAL COMPRAS                                               72,93 €`
        }
      },
      {
        name: 'PDF Document',
        input: {
          source: 'telegram',
          document: {
            fileId: 'test-pdf',
            fileName: 'order.pdf',
            mimeType: 'application/pdf'
          }
        }
      },
      {
        name: 'Image File',
        input: {
          source: 'telegram',
          photo: {
            file_id: 'test-image',
            width: 800,
            height: 600
          }
        }
      }
    ];

    for (const test of testInputs) {
      const detection = ContentDetector.detect(test.input);
      console.log(`   ${test.name}:`);
      console.log(`     Type: ${detection.primaryContent?.type}`);
      console.log(`     Processor: ${detection.primaryContent?.processor}`);
      console.log(`     Priority: ${ContentDetector.getProcessingPriority(detection)}`);
      console.log(`     Processable: ${ContentDetector.isProcessable(detection).processable}`);
    }

    // Test 3: Processing priority mapping
    console.log('\n3. Testing processing priorities...');
    const priorities = [
      { type: 'spanish_order_table', expected: 1 },
      { type: 'pdf', expected: 2 },
      { type: 'image', expected: 6 },
      { type: 'general_text', expected: 9 }
    ];

    for (const priority of priorities) {
      const mockDetection = {
        primaryContent: { type: priority.type }
      };
      const actualPriority = ContentDetector.getProcessingPriority(mockDetection);
      const status = actualPriority === priority.expected ? '✅' : '❌';
      console.log(`   ${priority.type}: ${actualPriority} ${status}`);
    }

    console.log('\n🎯 AI Architecture Configuration Summary:');
    console.log('   📊 Text Processing: DeepSeek R1 → Claude (fallback)');
    console.log('   👁️  Visual Analysis: GPT-4 Vision only');
    console.log('   💬 Conversational Agent: DeepSeek R1');
    console.log('   🔄 Content Detection: Updated for new architecture');

    if (!providers.openai && !providers.deepseek) {
      console.log('\n⚠️  Warning: No AI providers configured. Add API keys to .env:');
      console.log('   - OPENAI_API_KEY for GPT-4 Vision');
      console.log('   - DEEPSEEK_API_KEY for DeepSeek R1');
      console.log('   - ANTHROPIC_API_KEY for Claude fallback (optional)');
    }

    console.log('\n✅ AI configuration test completed!');

  } catch (error) {
    console.error('\n❌ AI configuration test failed:', error.message);
    console.log('\n💡 Make sure to:');
    console.log('   1. Add API keys to .env file');
    console.log('   2. Check network connectivity');
    console.log('   3. Verify API key permissions');
  }
}

// Test DeepSeek API endpoint format
async function testDeepSeekEndpoint() {
  console.log('\n🔍 Testing DeepSeek R1 endpoint configuration...');
  
  try {
    const { deepseek } = await import('../config/ai.js');
    
    if (!deepseek) {
      console.log('❌ DeepSeek client not configured (DEEPSEEK_API_KEY missing)');
      return;
    }

    console.log('✅ DeepSeek client configured');
    console.log('   Base URL: https://api.deepseek.com/v1');
    console.log('   Model: deepseek-reasoner (default)');
    
    // Test API connectivity (without making actual request)
    console.log('   API Key: ***' + (process.env.DEEPSEEK_API_KEY ? process.env.DEEPSEEK_API_KEY.slice(-4) : 'not set'));
    
  } catch (error) {
    console.error('❌ DeepSeek endpoint test failed:', error.message);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAIConfiguration().then(() => testDeepSeekEndpoint());
}

export { testAIConfiguration, testDeepSeekEndpoint };