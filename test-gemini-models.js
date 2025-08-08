// Test which Gemini models are actually available
import { processWithGemini } from './src/config/ai.js';

async function testGeminiModels() {
  const modelsToTest = [
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-1.5-pro-latest', 
    'gemini-1.5-pro',
    'gemini-2.0-flash-exp',
    'gemini-pro',
    'gemini-pro-vision'
  ];
  
  console.log('🧪 Testing Gemini Model Availability');
  console.log('='.repeat(50));
  
  for (const model of modelsToTest) {
    try {
      console.log(`\n📍 Testing: ${model}`);
      const result = await processWithGemini('Test message', { 
        model: model,
        maxTokens: 10
      });
      console.log(`✅ ${model}: Works (${result.model || model})`);
    } catch (error) {
      if (error.message.includes('does not exist') || error.message.includes('not found')) {
        console.log(`❌ ${model}: Model not found`);
      } else if (error.message.includes('permission') || error.message.includes('not enabled')) {
        console.log(`⚠️  ${model}: Permission/access issue`);
      } else {
        console.log(`❓ ${model}: Other error - ${error.message.substring(0, 100)}`);
      }
    }
  }
}

testGeminiModels().catch(console.error);