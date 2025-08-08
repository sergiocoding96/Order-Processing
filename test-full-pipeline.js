// Test the complete streamlined PDF processing pipeline
import { PDFProcessor } from './src/services/pdf-processor.js';
import { analyzeVisualContent, processTextWithFallback } from './src/config/ai.js';
import fs from 'fs';
import path from 'path';

async function testFullPipeline() {
  try {
    // Get PDF path from command line argument or use default
    const pdfPath = process.argv[2] || "/Users/sergiopalacio/Projects/Order Processing/Order Test/Order 1.pdf";
    
    console.log('📁 PDF Path:', pdfPath);
    
    console.log('🔄 Testing Complete Streamlined PDF Pipeline');
    console.log('='.repeat(50));
    
    // Step 1: PDF → Images
    console.log('\n📄 Step 1: Converting PDF to Images...');
    const result = await PDFProcessor.processPDF(pdfPath);
    
    if (result.success) {
      console.log('✅ PDF Processing Successful!');
      console.log('📊 Processing Steps:', result.processingSteps);
      console.log('🎯 Confidence:', result.confidence);
      console.log('📝 Method:', result.method);
      
      console.log('\n📋 Extracted Order Data:');
      console.log('='.repeat(30));
      console.log(JSON.stringify(result.extractedData, null, 2));
      
      // Save result to file for viewing
      const outputPath = '/Users/sergiopalacio/Projects/Order Processing/order1_result.json';
      fs.writeFileSync(outputPath, JSON.stringify(result.extractedData, null, 2));
      console.log(`\n💾 Results saved to: ${outputPath}`);
      
    } else {
      console.log('❌ PDF Processing Failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Pipeline Test Failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testFullPipeline();