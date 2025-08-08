// Test the Gemini 2.0 Flash infrastructure setup
import { checkAIProviders, processTextWithFallback } from './src/config/ai.js';

async function testGeminiSetup() {
  try {
    console.log('🔍 Checking AI Provider Availability...');
    console.log('='.repeat(50));
    
    const providers = checkAIProviders();
    
    console.log('Provider Status:');
    console.log(`✅ OpenAI (GPT-4 Vision): ${providers.openai ? 'Available' : 'Not configured'}`);
    console.log(`🚀 Gemini 2.0 Flash: ${providers.gemini ? 'Available' : 'Not configured'}`);
    console.log(`✅ DeepSeek R1: ${providers.deepseek ? 'Available' : 'Not configured'}`);
    console.log(`${providers.anthropic ? '✅' : '❌'} Claude: ${providers.anthropic ? 'Available' : 'Not configured'}`);
    
    console.log('\n🧪 Testing Gemini 2.0 Flash Processing...');
    console.log('='.repeat(50));
    
    // Test with a simple prompt
    const testPrompt = `Extract information from this text and return JSON:
    
    "Order #12345 for John Doe: 2x Apples, 3x Oranges, Total: $15"
    
    Return only this JSON:
    {
      "order_id": "12345",
      "customer": "John Doe", 
      "products": [
        {"name": "Apples", "quantity": 2},
        {"name": "Oranges", "quantity": 3}
      ],
      "total": 15
    }`;
    
    const result = await processTextWithFallback(testPrompt, {
      responseFormat: { type: 'json_object' },
      maxTokens: 1000,
      temperature: 0.1
    });
    
    console.log(`✅ Fallback test successful using: ${result.provider}`);
    console.log('📋 Response preview:', result.content.substring(0, 100) + '...');
    
    if (result.provider === 'gemini') {
      console.log('\n🚀 Gemini 2.0 Flash is working!');
      console.log('⚡ Fast reasoning enabled - optimized speed!');
      console.log('📈 Expected speed: 5-15 seconds (vs 60+ with DeepSeek R1)');
    } else {
      console.log('\n⚠️  Gemini 2.0 Flash not available, using fallback:', result.provider);
      console.log('\n📋 To enable Gemini 2.0 Flash:');
      console.log('1. Get API key from: https://ai.google.dev/');
      console.log('2. Add GEMINI_API_KEY=your-key-here to .env file');
      console.log('3. Test again');
    }
    
  } catch (error) {
    console.error('❌ Setup test failed:', error.message);
  }
}

testGeminiSetup();