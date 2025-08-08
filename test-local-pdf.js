// Test mailhook with a real local PDF file
import http from 'http';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

// Create multipart form data manually
function createMultipartForm(fields, files) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
  let body = Buffer.alloc(0);

  // Add form fields
  for (const [key, value] of Object.entries(fields)) {
    const fieldHeader = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`);
    body = Buffer.concat([body, fieldHeader]);
  }

  // Add files
  for (const file of files) {
    const fileHeader = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`);
    const fileFooter = Buffer.from('\r\n');
    body = Buffer.concat([body, fileHeader, file.content, fileFooter]);
  }

  const endBoundary = Buffer.from(`--${boundary}--\r\n`);
  body = Buffer.concat([body, endBoundary]);

  return {
    body: body,
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

async function testLocalPDF(pdfPath) {
  console.log(`📄 Testing with local PDF: ${pdfPath}\n`);

  // Check if file exists
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  // Read the PDF file
  const pdfContent = fs.readFileSync(pdfPath);
  const fileName = path.basename(pdfPath);
  
  console.log(`📋 File Info:`);
  console.log(`   File: ${fileName}`);
  console.log(`   Size: ${(pdfContent.length / 1024).toFixed(2)} KB`);
  console.log(`   Path: ${pdfPath}`);

  const formData = createMultipartForm(
    {
      from: 'proveedor@restaurant-local.com',
      to: 'pedidos@mirestaurante.com',
      subject: `Pedido Local - ${fileName}`,
      body: `Por favor procese el pedido adjunto en el archivo: ${fileName}`,
      messageId: 'local-pdf-' + Date.now()
    },
    [
      {
        name: 'attachments',
        filename: fileName,
        contentType: 'application/pdf',
        content: pdfContent
      }
    ]
  );

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/webhook/mailhook',
      method: 'POST',
      headers: {
        'Content-Type': formData.contentType,
        'Content-Length': formData.body.length
      }
    };

    console.log(`\n📤 Sending to mailhook...`);

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          
          console.log('\n📥 Response received:');
          console.log(`   Success: ${result.success ? 'Yes' : 'No'}`);
          console.log(`   Message ID: ${result.email?.messageId || 'N/A'}`);
          console.log(`   From: ${result.email?.from || 'N/A'}`);
          console.log(`   Subject: ${result.email?.subject || 'N/A'}`);
          console.log(`   Attachments: ${result.email?.attachmentCount || 0}`);
          console.log(`   Content Type: ${result.detection?.primaryContentType || 'N/A'}`);
          console.log(`   Processable: ${result.detection?.processable ? 'Yes' : 'No'}`);
          console.log(`   Priority: ${result.detection?.priority || 'N/A'}`);
          console.log(`   Queue ID: ${result.queueId || 'None'}`);
          
          if (result.detection?.processable === false) {
            console.log(`   Reason not processable: ${result.warning || 'Unknown'}`);
          }

          if (result.queueId) {
            console.log(`\n🔄 Processing started! Monitor logs to see AI extraction results:`);
            console.log(`   tail -f logs/combined.log`);
          }
          
          resolve(result);
        } catch (e) {
          reject(new Error('Invalid JSON response: ' + body));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(formData.body);
    req.end();
  });
}

// Interactive PDF path input
async function promptForPDFPath() {
  // Check common locations for PDF files
  const commonPaths = [
    '~/Downloads',
    '~/Documents',
    '~/Desktop'
  ];

  console.log('🔍 Looking for PDF files in common locations...\n');

  for (const dir of commonPaths) {
    const expandedPath = dir.replace('~', process.env.HOME);
    
    if (fs.existsSync(expandedPath)) {
      const files = fs.readdirSync(expandedPath)
        .filter(file => file.toLowerCase().endsWith('.pdf'))
        .slice(0, 5); // Show max 5 files

      if (files.length > 0) {
        console.log(`📁 Found PDFs in ${dir}:`);
        files.forEach((file, index) => {
          console.log(`   ${index + 1}. ${file}`);
        });
        console.log();
      }
    }
  }

  console.log('📝 To test with your PDF, use:');
  console.log('   node test-local-pdf.js "/path/to/your/file.pdf"');
  console.log('\nExample:');
  console.log('   node test-local-pdf.js "~/Downloads/pedido.pdf"');
  console.log('   node test-local-pdf.js "/Users/yourname/Documents/order.pdf"');
}

// Main execution
async function main() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    await promptForPDFPath();
    return;
  }

  // Expand ~ to home directory
  const expandedPath = pdfPath.replace('~', process.env.HOME);

  try {
    await testLocalPDF(expandedPath);
    console.log('\n✅ Local PDF test completed successfully!');
  } catch (error) {
    console.error('\n❌ Local PDF test failed:', error.message);
  }
}

main().catch(console.error);