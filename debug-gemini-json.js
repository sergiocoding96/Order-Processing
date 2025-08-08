// Debug script to examine Gemini JSON response issues
import { PDFProcessor } from './src/services/pdf-processor.js';
import fs from 'fs';
import path from 'path';

async function debugGeminiJSON() {
  try {
    const failedFiles = [
      'outlook_email_attachment(2).pdf',
      'outlook_email_attachment(4).pdf', 
      'outlook_email_attachment(6).pdf'
    ];
    
    const testFilesDir = '/Users/sergiopalacio/Projects/Order Processing/Test Files Leo';
    
    console.log('🔍 Debugging Gemini JSON Response Issues');
    console.log('='.repeat(50));
    
    for (let i = 0; i < failedFiles.length; i++) {
      const file = failedFiles[i];
      const filePath = path.join(testFilesDir, file);
      
      console.log(`\n📄 Debugging ${i + 1}/${failedFiles.length}: ${file}`);
      console.log('-'.repeat(40));
      
      try {
        // Step 1: Test GPT-4 Vision extraction
        console.log('Step 1: Testing GPT-4 Vision extraction...');
        const imageConversion = await PDFProcessor.convertPDFToImages(filePath);
        
        if (!imageConversion.success) {
          console.log('❌ Image conversion failed:', imageConversion.error);
          continue;
        }
        
        const visionResult = await PDFProcessor.processWithVision(imageConversion.images);
        
        if (!visionResult.success) {
          console.log('❌ GPT-4 Vision failed:', visionResult.error);
          continue;
        }
        
        console.log('✅ GPT-4 Vision successful');
        console.log('Vision output preview:', visionResult.rawResponse.substring(0, 200) + '...');
        
        // Step 2: Test Gemini reasoning step with enhanced debugging
        console.log('\nStep 2: Testing Gemini reasoning with DEBUG...');
        
        const reasoningPrompt = `Based on this GPT-4 Vision analysis of a Spanish invoice, create a structured JSON extraction.

GPT-4 Vision Analysis:
${visionResult.rawResponse}

Instructions:
1. Validate the extracted information
2. Fill in any missing details logically
3. Ensure price calculations are correct
4. Structure the data properly

Return ONLY a valid JSON object in this exact format:
{
  "numero_pedido": "order number if mentioned",
  "cliente": "customer name if mentioned", 
  "fecha_pedido": "order date in YYYY-MM-DD format if mentioned",
  "productos": [
    {
      "nombre_producto": "product name",
      "cantidad": number,
      "unidad": "unit (Kilogramo, Litro, etc.)",
      "precio_unitario": number,
      "total_producto": number
    }
  ],
  "total_pedido": number,
  "observaciones": "any additional notes"
}

Rules:
- Extract all products with their quantities and prices
- Convert all prices to numbers (remove € symbol) 
- Use null for missing information
- Maintain Spanish product names
- Verify and correct calculations if needed
- Return ONLY the JSON object, no other text`;

        // Import directly to test Gemini
        const { processWithGemini } = await import('./src/config/ai.js');
        
        const result = await processWithGemini(reasoningPrompt, {
          maxTokens: 4000,
          temperature: 0.1,
          responseFormat: { type: 'json_object' }
        });
        
        console.log('\n🔍 FULL GEMINI RESPONSE:');
        console.log('Provider:', result.provider);
        console.log('Content length:', result.content.length);
        console.log('Content:');
        console.log('---START RESPONSE---');
        console.log(result.content);
        console.log('---END RESPONSE---');
        
        // Test JSON parsing
        console.log('\n🧪 Testing JSON Parsing:');
        try {
          let jsonContent = result.content;
          
          // Apply current parsing logic
          if (result.provider === 'gemini') {
            const jsonMatch = result.content.match(/```json\s*(\{[\s\S]*?\})\s*```/) || 
                             result.content.match(/(\{[\s\S]*\})/);
            if (jsonMatch) {
              jsonContent = jsonMatch[1] || jsonMatch[0];
            }
            jsonContent = jsonContent.replace(/```json|```/g, '').trim();
          }
          
          console.log('Extracted JSON content:');
          console.log('---START JSON---');
          console.log(jsonContent);
          console.log('---END JSON---');
          
          const parsed = JSON.parse(jsonContent);
          console.log('✅ JSON parsing successful!');
          console.log('Parsed fields:', Object.keys(parsed));
          
        } catch (parseError) {
          console.log('❌ JSON parsing failed:', parseError.message);
          
          // Character-by-character analysis
          console.log('\n🔬 Character Analysis:');
          console.log('Last 50 characters:', JSON.stringify(result.content.slice(-50)));
          console.log('First 50 characters:', JSON.stringify(result.content.slice(0, 50)));
          
          // Look for common JSON issues
          const braceCount = (result.content.match(/\{/g) || []).length;
          const closingBraceCount = (result.content.match(/\}/g) || []).length;
          console.log('Opening braces:', braceCount);
          console.log('Closing braces:', closingBraceCount);
          
          if (braceCount !== closingBraceCount) {
            console.log('⚠️  Brace mismatch detected!');
          }
          
          // Check for truncation
          if (result.content.length > 3900) {
            console.log('⚠️  Response might be truncated (near max tokens)');
          }
        }
        
      } catch (error) {
        console.log('❌ Debug failed for', file, ':', error.message);
        console.log('Stack:', error.stack);
      }
      
      console.log('\n' + '='.repeat(50));
    }
    
  } catch (error) {
    console.error('❌ Debug script failed:', error.message);
  }
}

debugGeminiJSON();