// Test mailhook with file attachments
import http from 'http';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

// Create multipart form data manually
function createMultipartForm(fields, files) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
  let body = '';

  // Add form fields
  for (const [key, value] of Object.entries(fields)) {
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
    body += `${value}\r\n`;
  }

  // Add files
  for (const file of files) {
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\n`;
    body += `Content-Type: ${file.contentType}\r\n\r\n`;
    body += file.content;
    body += '\r\n';
  }

  body += `--${boundary}--\r\n`;

  return {
    body: Buffer.from(body),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

async function testAttachment() {
  console.log('📎 Testing Mailhook with PDF Attachment...\n');

  // Create a simple test PDF content
  const testPdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 120
>>
stream
BT
/F1 12 Tf
72 720 Td
(PEDIDO RESTAURANTE) Tj
0 -20 Td
(Arroz Basmati - 5kg - 25.50€) Tj
0 -20 Td
(Aceite Oliva - 2L - 18.90€) Tj
0 -20 Td
(TOTAL: 44.40€) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000125 00000 n 
0000000230 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
400
%%EOF`;

  const formData = createMultipartForm(
    {
      from: 'supplier@food-distributor.es',
      to: 'orders@restaurant.com',
      subject: 'Pedido Semanal - PDF Adjunto',
      body: 'Estimado cliente, adjunto encontrará el pedido semanal en formato PDF.',
      messageId: 'test-pdf-' + Date.now()
    },
    [
      {
        name: 'attachments',
        filename: 'pedido-semanal.pdf',
        contentType: 'application/pdf',
        content: testPdfContent
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

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          
          console.log('✅ PDF attachment test successful');
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

// Test image attachment
async function testImageAttachment() {
  console.log('\n🖼️  Testing Mailhook with Image Attachment...\n');

  // Create a simple 1x1 PNG image (base64 decoded)
  const pngData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');

  const formData = createMultipartForm(
    {
      from: 'proveedor@distribuidora.com',
      to: 'pedidos@restaurante.es',
      subject: 'Pedido - Imagen Adjunta',
      body: 'Por favor revise la imagen adjunta con los productos solicitados.',
      messageId: 'test-image-' + Date.now()
    },
    [
      {
        name: 'attachments',
        filename: 'lista-productos.png',
        contentType: 'image/png',
        content: pngData
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

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          
          console.log('✅ Image attachment test successful');
          console.log(`   Message ID: ${result.email?.messageId || 'N/A'}`);
          console.log(`   From: ${result.email?.from || 'N/A'}`);
          console.log(`   Subject: ${result.email?.subject || 'N/A'}`);
          console.log(`   Attachments: ${result.email?.attachmentCount || 0}`);
          console.log(`   Content Type: ${result.detection?.primaryContentType || 'N/A'}`);
          console.log(`   Processable: ${result.detection?.processable ? 'Yes' : 'No'}`);
          console.log(`   Priority: ${result.detection?.priority || 'N/A'}`);
          console.log(`   Queue ID: ${result.queueId || 'None'}`);
          
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

// Run attachment tests
async function runAttachmentTests() {
  console.log('🚀 Testing Mailhook Attachment Processing\n');
  console.log('='.repeat(50));

  const results = { passed: 0, failed: 0 };

  // Test PDF attachment
  try {
    await testAttachment();
    results.passed++;
    console.log('✅ PDF Attachment Test PASSED');
  } catch (error) {
    results.failed++;
    console.log('❌ PDF Attachment Test FAILED:', error.message);
  }

  // Test Image attachment
  try {
    await testImageAttachment();
    results.passed++;
    console.log('✅ Image Attachment Test PASSED');
  } catch (error) {
    results.failed++;
    console.log('❌ Image Attachment Test FAILED:', error.message);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Attachment Test Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

  if (results.failed === 0) {
    console.log('\n🎉 All attachment tests passed! Mailhook attachment processing is working.');
  } else {
    console.log('\n⚠️  Some attachment tests failed. Please check the errors above.');
  }

  return results;
}

runAttachmentTests().catch(console.error);