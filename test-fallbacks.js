// Test fallback providers for JSON generation reliability
import { processWithDeepSeek, processWithClaude, processWithGemini } from './src/config/ai.js';

async function testFallbackProviders() {
  const testPrompt = `Extract information from this Spanish invoice text and return ONLY valid JSON:

"PEDIDO 12345 - Cliente: SUPERMERCADO ABC S.L. - Fecha: 2024-12-01
Productos:
- Arroz Basmati 5kg x2 = €15.50 cada uno = €31.00
- Aceite Oliva 1L x3 = €8.20 cada uno = €24.60
TOTAL: €55.60"

Return ONLY this JSON format:
{
  "numero_pedido": "12345",
  "cliente": "SUPERMERCADO ABC S.L.",
  "fecha_pedido": "2024-12-01",
  "productos": [
    {"nombre_producto": "Arroz Basmati 5kg", "cantidad": 2, "precio_unitario": 15.50, "total_producto": 31.00},
    {"nombre_producto": "Aceite Oliva 1L", "cantidad": 3, "precio_unitario": 8.20, "total_producto": 24.60}
  ],
  "total_pedido": 55.60
}`;

  const providers = [
    { name: 'Gemini 2.0 Flash', test: () => processWithGemini(testPrompt, {responseFormat: {type: 'json_object'}}) },
    { name: 'DeepSeek R1', test: () => processWithDeepSeek(testPrompt, {responseFormat: {type: 'json_object'}}) },
    { name: 'Claude 3.5', test: () => processWithClaude(testPrompt) }
  ];

  console.log('🧪 Testing Fallback Provider Reliability');
  console.log('='.repeat(50));

  const results = [];

  for (const provider of providers) {
    console.log(`\n📍 Testing: ${provider.name}`);
    console.log('-'.repeat(30));
    
    try {
      const startTime = Date.now();
      const result = await provider.test();
      const duration = (Date.now() - startTime) / 1000;
      
      // Test JSON parsing
      try {
        let jsonContent = result.content;
        
        // Handle different formats
        if (provider.name.includes('DeepSeek')) {
          const jsonMatch = result.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) jsonContent = jsonMatch[0];
        }
        
        const parsed = JSON.parse(jsonContent);
        
        console.log(`✅ ${provider.name}: Success`);
        console.log(`   ⏱️  Time: ${duration.toFixed(1)}s`);
        console.log(`   📊 Response length: ${result.content.length} chars`);
        console.log(`   🎯 JSON fields: ${Object.keys(parsed).length}`);
        console.log(`   💰 Total extracted: €${parsed.total_pedido || 'N/A'}`);
        
        results.push({
          provider: provider.name,
          success: true,
          duration,
          responseLength: result.content.length,
          fields: Object.keys(parsed).length,
          parseable: true
        });
        
      } catch (parseError) {
        console.log(`⚠️  ${provider.name}: Response received but JSON invalid`);
        console.log(`   ⏱️  Time: ${duration.toFixed(1)}s`);
        console.log(`   ❌ Parse error: ${parseError.message}`);
        console.log(`   📄 Content preview: ${result.content.substring(0, 100)}...`);
        
        results.push({
          provider: provider.name,
          success: false,
          duration,
          responseLength: result.content.length,
          parseable: false,
          error: 'JSON_PARSE_ERROR'
        });
      }
      
    } catch (error) {
      console.log(`❌ ${provider.name}: Failed`);
      console.log(`   🚫 Error: ${error.message.substring(0, 100)}`);
      
      results.push({
        provider: provider.name,
        success: false,
        error: error.message,
        parseable: false
      });
    }
  }

  // Summary
  console.log('\n📊 FALLBACK PROVIDER ANALYSIS');
  console.log('='.repeat(50));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful providers: ${successful.length}/${results.length}`);
  
  if (successful.length > 0) {
    console.log('\n🎯 Recommended Fallback Order:');
    successful
      .sort((a, b) => a.duration - b.duration)
      .forEach((result, index) => {
        console.log(`${index + 1}. ${result.provider} (${result.duration.toFixed(1)}s)`);
      });
  }
  
  if (failed.length > 0) {
    console.log('\n⚠️  Problematic Providers:');
    failed.forEach(result => {
      console.log(`- ${result.provider}: ${result.error || 'Parse failed'}`);
    });
  }

  // Recommendation
  console.log('\n💡 RECOMMENDATION:');
  if (successful.length >= 2) {
    console.log('✅ Keep fallback chain - multiple providers working');
    console.log(`   Primary: ${successful[0].provider}`);
    console.log(`   Fallback: ${successful[1]?.provider || 'None needed'}`);
  } else if (successful.length === 1) {
    console.log('⚠️  Consider fallback optional - only one provider reliable');
    console.log(`   Single provider: ${successful[0].provider}`);
  } else {
    console.log('❌ All providers failing - need configuration review');
  }
}

testFallbackProviders().catch(console.error);