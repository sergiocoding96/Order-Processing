import { LocalDatabase } from '../../config/local-database.js';
import fs from 'fs';
import path from 'path';
import assert from 'node:assert/strict';

// Prepare a temp data directory for isolated tests
const dataDir = path.join(process.cwd(), 'Order Processing', 'data');
const pedidosFile = path.join(dataDir, 'pedidos.json');
const productosFile = path.join(dataDir, 'productos.json');

// Ensure clean files
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(pedidosFile, JSON.stringify([], null, 2));
fs.writeFileSync(productosFile, JSON.stringify([], null, 2));

// 1) Create order then duplicate
const order = await LocalDatabase.createPedido({
    numero_pedido: 'DUP-1',
    cliente: 'Test',
    fecha_pedido: '2025-08-12',
    canal_origen: 'telegram',
    total_pedido: 10,
    observaciones: 'ok'
});

const duplicate = await LocalDatabase.createPedido({
    numero_pedido: 'DUP-1',
    cliente: 'Test 2',
    fecha_pedido: '2025-08-12',
    canal_origen: 'telegram',
    total_pedido: 20,
    observaciones: 'duplicate'
});

assert.equal(order.id, duplicate.id);

// 2) Create products mapping various shapes
const products = await LocalDatabase.createProductos(order.id, [
    { nombre: 'Tomate', cantidad: 2, precio_unitario: 3, unidad: 'kg' },
    { nombre_producto: 'Pepino', cantidad: 1, precio_unitario: 2, total_producto: 2, unidad: 'kg' },
    { descripcion: 'Zanahoria', cantidad: 4, precio_unitario: 1.5, unidad: 'kg' }
]);

assert.equal(products.length, 3);
assert.equal(products[0].nombre, 'Tomate');
assert.equal(products[1].nombre, 'Pepino');
assert.equal(products[2].nombre, 'Zanahoria');
assert.equal(products[2].precio_total, 6);

console.log('✅ local-db tests passed');

