import { testConnection } from '../config/database.js';
import { PedidosModel } from '../models/pedidos.js';
import { ProductosModel } from '../models/productos.js';
import logger from '../utils/logger.js';

async function runDatabaseTests() {
  console.log('🔍 Starting database tests...\n');

  try {
    // Test 1: Database connection
    console.log('1. Testing database connection...');
    const connectionResult = await testConnection();
    console.log(connectionResult ? '✅ Connection successful' : '❌ Connection failed');
    
    if (!connectionResult) {
      console.log('⚠️  Database connection failed. Please check your Supabase credentials in .env file');
      console.log('   Make sure you have:');
      console.log('   - SUPABASE_URL');
      console.log('   - SUPABASE_ANON_KEY');
      console.log('   - SUPABASE_SERVICE_KEY');
      console.log('   And that the database schema has been created.');
      return;
    }

    // Test 2: Create a test order
    console.log('\n2. Testing order creation...');
    const testOrder = {
      numero_pedido: `TEST-${Date.now()}`,
      cliente: 'Cliente Test',
      fecha_pedido: new Date().toISOString().split('T')[0],
      canal_origen: 'telegram',
      total_pedido: 156.87,
      observaciones: 'Pedido de prueba',
      estado: 'procesado'
    };

    const createdOrder = await PedidosModel.create(testOrder);
    console.log('✅ Order created:', createdOrder.numero_pedido);

    // Test 3: Create test products
    console.log('\n3. Testing product creation...');
    const testProducts = [
      {
        nombre_producto: 'ARROZ JAZMIN',
        cantidad: 10,
        unidad: 'Kilogramo',
        precio_unitario: 2.80,
        total_producto: 28.00
      },
      {
        nombre_producto: 'HUMMUS',
        cantidad: 5,
        unidad: 'Kilogramo',
        precio_unitario: 18.99,
        total_producto: 94.95
      },
      {
        nombre_producto: 'ACEITE OLIVA',
        cantidad: 2,
        unidad: 'Litro',
        precio_unitario: 16.96,
        total_producto: 33.92
      }
    ];

    const createdProducts = await ProductosModel.createMany(createdOrder.id, testProducts);
    console.log(`✅ Products created: ${createdProducts.length} items`);

    // Test 4: Read operations
    console.log('\n4. Testing read operations...');
    
    const foundOrder = await PedidosModel.findById(createdOrder.id);
    console.log(`✅ Order found with ${foundOrder.pedido_productos?.length || 0} products`);

    const allOrders = await PedidosModel.findAll({ limit: 5 });
    console.log(`✅ Found ${allOrders.length} orders in database`);

    // Test 5: Statistics
    console.log('\n5. Testing statistics...');
    const stats = await PedidosModel.getStats();
    console.log('✅ Statistics generated:', {
      total_orders: stats.total_orders,
      total_amount: stats.total_amount.toFixed(2),
      channels: Object.keys(stats.by_channel)
    });

    // Test 6: Top products
    const topProducts = await ProductosModel.getTopProducts({ limit: 3 });
    console.log(`✅ Top products found: ${topProducts.length} items`);

    // Test 7: Update operation
    console.log('\n6. Testing update operations...');
    const updatedOrder = await PedidosModel.update(createdOrder.id, {
      observaciones: 'Pedido actualizado en prueba'
    });
    console.log('✅ Order updated successfully');

    // Test 8: Cleanup - Delete test data
    console.log('\n7. Cleaning up test data...');
    await PedidosModel.delete(createdOrder.id);
    console.log('✅ Test order deleted (cascade should remove products)');

    console.log('\n🎉 All database tests passed successfully!');
    console.log('\n📋 Database is ready for the application:');
    console.log('   ✅ Connection established');
    console.log('   ✅ CRUD operations working');
    console.log('   ✅ Relationships functioning');
    console.log('   ✅ Statistics and queries operational');
    
  } catch (error) {
    console.error('\n❌ Database test failed:', error.message);
    
    if (error.code === 'PGRST116') {
      console.log('\n💡 It looks like the database tables don\'t exist yet.');
      console.log('   Please run the SQL schema from src/config/schema.sql in your Supabase SQL Editor.');
    } else if (error.message.includes('Invalid API key')) {
      console.log('\n💡 Please check your Supabase API keys in the .env file.');
    } else {
      console.log('\n💡 Error details:', error);
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDatabaseTests();
}

export { runDatabaseTests };