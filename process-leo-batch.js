// Batch process all PDF files in Test Files Leo directory
import { PDFProcessor } from './src/services/pdf-processor.js';
import fs from 'fs';
import path from 'path';

async function processLeoBatch() {
  try {
    const testFilesDir = '/Users/sergiopalacio/Projects/Order Processing/Test Files Leo';
    const outputDir = '/Users/sergiopalacio/Projects/Order Processing/leo_results';
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Get all PDF files from Test Files Leo directory
    const files = fs.readdirSync(testFilesDir).filter(file => file.endsWith('.pdf'));
    
    console.log('🔄 Processing Leo Test Files Batch');
    console.log('='.repeat(50));
    console.log(`📁 Found ${files.length} PDF files to process`);
    
    const results = [];
    const summary = {
      totalFiles: files.length,
      successful: 0,
      failed: 0,
      totalProducts: 0,
      totalOrders: 0,
      totalValue: 0,
      processingTimes: []
    };
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(testFilesDir, file);
      
      console.log(`\n📄 Processing ${i + 1}/${files.length}: ${file}`);
      console.log('-'.repeat(40));
      
      const startTime = Date.now();
      
      try {
        const result = await PDFProcessor.processPDF(filePath);
        const processingTime = (Date.now() - startTime) / 1000;
        
        if (result.success) {
          console.log(`✅ Success! Extracted ${result.extractedData.productos?.length || 0} products`);
          console.log(`⏱️  Processing time: ${processingTime.toFixed(1)}s`);
          console.log(`💰 Order total: €${result.extractedData.total_pedido || 'N/A'}`);
          
          // Save individual result
          const outputFile = path.join(outputDir, `${file.replace('.pdf', '_result.json')}`);
          fs.writeFileSync(outputFile, JSON.stringify(result.extractedData, null, 2));
          
          // Update summary
          summary.successful++;
          summary.totalProducts += result.extractedData.productos?.length || 0;
          summary.totalOrders++;
          summary.totalValue += result.extractedData.total_pedido || 0;
          summary.processingTimes.push(processingTime);
          
          results.push({
            file: file,
            success: true,
            data: result.extractedData,
            processingTime: processingTime,
            confidence: result.confidence
          });
          
        } else {
          console.log(`❌ Failed: ${result.error}`);
          summary.failed++;
          results.push({
            file: file,
            success: false,
            error: result.error,
            processingTime: processingTime
          });
        }
        
      } catch (error) {
        const processingTime = (Date.now() - startTime) / 1000;
        console.log(`❌ Error: ${error.message}`);
        summary.failed++;
        results.push({
          file: file,
          success: false,
          error: error.message,
          processingTime: processingTime
        });
      }
    }
    
    // Generate batch summary
    console.log('\n📊 BATCH PROCESSING SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Successful: ${summary.successful}/${summary.totalFiles}`);
    console.log(`❌ Failed: ${summary.failed}/${summary.totalFiles}`);
    console.log(`📦 Total products extracted: ${summary.totalProducts}`);
    console.log(`💰 Total order value: €${summary.totalValue.toFixed(2)}`);
    
    if (summary.processingTimes.length > 0) {
      const avgTime = summary.processingTimes.reduce((a, b) => a + b, 0) / summary.processingTimes.length;
      const maxTime = Math.max(...summary.processingTimes);
      const minTime = Math.min(...summary.processingTimes);
      console.log(`⏱️  Processing times: avg ${avgTime.toFixed(1)}s, min ${minTime.toFixed(1)}s, max ${maxTime.toFixed(1)}s`);
    }
    
    // Save complete results
    const batchResultFile = path.join(outputDir, 'batch_summary.json');
    fs.writeFileSync(batchResultFile, JSON.stringify({
      summary: summary,
      results: results,
      processedAt: new Date().toISOString()
    }, null, 2));
    
    console.log(`\n💾 Results saved to: ${outputDir}`);
    console.log(`📋 Batch summary: ${batchResultFile}`);
    
    // Show individual file results
    console.log('\n📄 INDIVIDUAL FILE RESULTS:');
    console.log('='.repeat(50));
    results.forEach((result, index) => {
      if (result.success) {
        console.log(`${index + 1}. ✅ ${result.file}`);
        console.log(`   Order: ${result.data.numero_pedido || 'N/A'}`);
        console.log(`   Customer: ${result.data.cliente || 'N/A'}`);
        console.log(`   Products: ${result.data.productos?.length || 0}`);
        console.log(`   Total: €${result.data.total_pedido || 'N/A'}`);
        console.log(`   Time: ${result.processingTime.toFixed(1)}s`);
      } else {
        console.log(`${index + 1}. ❌ ${result.file} - ${result.error}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Batch processing failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

processLeoBatch();