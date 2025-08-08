// Direct test of pdf2pic conversion
import pdf2pic from 'pdf2pic';
import path from 'path';
import fs from 'fs';

async function testPdf2pic() {
  try {
    const pdfPath = "/Users/sergiopalacio/Projects/Order Processing/Order Test/Order 1.pdf";
    const outputDir = "/Users/sergiopalacio/Projects/Order Processing/test_output";
    
    console.log('Testing pdf2pic conversion...');
    console.log('PDF Path:', pdfPath);
    console.log('Output Dir:', outputDir);
    
    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Check if PDF exists
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }
    
    console.log('PDF file exists:', fs.existsSync(pdfPath));
    console.log('PDF file size:', fs.statSync(pdfPath).size, 'bytes');
    
    // Test GraphicsMagick availability
    console.log('\nTesting GraphicsMagick...');
    const { exec } = await import('child_process');
    exec('which gm', (error, stdout, stderr) => {
      if (error) {
        console.log('GraphicsMagick (gm) not found in PATH');
      } else {
        console.log('GraphicsMagick found at:', stdout.trim());
      }
    });
    
    exec('which gs', (error, stdout, stderr) => {
      if (error) {
        console.log('Ghostscript (gs) not found in PATH');
      } else {
        console.log('Ghostscript found at:', stdout.trim());
      }
    });
    
    // Configure pdf2pic
    const convert = pdf2pic.fromPath(pdfPath, {
      density: 100,           // Lower DPI for testing
      saveFilename: "test_page",
      savePath: outputDir,
      format: "png",
      width: 800,
      height: 1000
    });
    
    console.log('\nAttempting conversion...');
    
    // Convert just the first page
    const result = await convert(1);
    
    console.log('Conversion successful!');
    console.log('Result:', result);
    
    // Check if file was created
    if (fs.existsSync(result.path)) {
      console.log('File created successfully at:', result.path);
      console.log('File size:', fs.statSync(result.path).size, 'bytes');
    } else {
      console.log('File was not created at expected path:', result.path);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Full error:', error);
  }
}

testPdf2pic();