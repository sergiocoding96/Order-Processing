// Check processing results for Order 1.pdf
import { LocalDatabase } from './src/config/local-database.js';
import fs from 'fs';

async function checkResults() {
  console.log('🔍 Checking processing results for Order 1.pdf...\n');

  // Check recent orders
  const orders = await LocalDatabase.findAllPedidos({ limit: 10 });
  const orderFromPdf = orders.find(order => 
    order.metadata?.original?.messageId?.includes('local-pdf-1754431501280') ||
    order.numero_pedido?.includes('1754431501')
  );

  if (orderFromPdf) {
    console.log('✅ Order from PDF found!');
    console.log('📋 Order Details:');
    console.log(`   Order ID: ${orderFromPdf.id}`);
    console.log(`   Order Number: ${orderFromPdf.numero_pedido}`);
    console.log(`   Client: ${orderFromPdf.cliente}`);
    console.log(`   Date: ${orderFromPdf.fecha_pedido}`);
    console.log(`   Total: €${orderFromPdf.total_pedido}`);
    console.log(`   Status: ${orderFromPdf.estado}`);
    console.log(`   Products: ${orderFromPdf.pedido_productos?.length || 0}`);

    if (orderFromPdf.pedido_productos && orderFromPdf.pedido_productos.length > 0) {
      console.log('\n🛒 Extracted Products:');
      orderFromPdf.pedido_productos.forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.nombre}`);
        console.log(`      Quantity: ${product.cantidad} ${product.unidad || ''}`);
        console.log(`      Unit Price: €${product.precio_unitario || 'N/A'}`);
        console.log(`      Total: €${product.precio_total || 'N/A'}`);
        console.log();
      });
    }

    console.log('🎯 Processing Metadata:');
    if (orderFromPdf.metadata?.processing) {
      console.log(`   Confidence: ${orderFromPdf.metadata.processing.confidence}%`);
      console.log(`   AI Model: ${orderFromPdf.metadata.processing.processingMethod || 'N/A'}`);
      console.log(`   Processed: ${orderFromPdf.metadata.processing.processedAt}`);
    }
  } else {
    console.log('⏳ PDF still being processed...');
    console.log('💡 GPT-4 Vision typically takes 30-90 seconds for PDF analysis');
    console.log('🔄 Run this script again in a few moments: node check-results.js');
  }

  // Show all recent orders
  console.log(`\n📊 Total orders in database: ${orders.length}`);
  if (orders.length > 0) {
    console.log('📋 Recent orders:');
    orders.slice(0, 5).forEach((order, index) => {
      console.log(`   ${index + 1}. ${order.numero_pedido} - €${order.total_pedido} (${order.estado})`);
    });
  }
}

checkResults().catch(console.error);