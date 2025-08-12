import { normalizeOrderData } from '../../utils/normalizer.js';
import assert from 'node:assert/strict';

// Basic unit tests for normalization utilities
const sample = {
    numero_pedido: '  P-001  ',
    cliente: '  Leo Foods  ',
    fecha_pedido: '12/08/2025',
    total_pedido: '1.234,56 €',
    observaciones: '  Urgente  ',
    productos: [
        { nombre: ' Tomate pera ', cantidad: '10', precio_unitario: '1,50', unidad: 'kg' },
        { descripcion: 'Caja Fresas', cantidad: '2', precio_unitario: '12,00', unidad: 'caja' },
        { nombre_producto: 'AGUA 1.5L', cantidad: '3', precio_unitario: '0,75', total_producto: '2,25', unidad: 'ud' }
    ]
};

const normalized = normalizeOrderData(sample);

assert.equal(normalized.numero_pedido, 'P-001');
assert.equal(normalized.cliente, 'Leo Foods');
assert.equal(normalized.cliente_codigo, 'LEO1987');
assert.equal(normalized.fecha_pedido, '2025-08-12');
assert.equal(normalized.total_pedido, 1234.56);
assert.equal(normalized.observaciones, 'Urgente');
assert.equal(normalized.productos.length, 3);

// product 1
assert.equal(normalized.productos[0].nombre_producto, 'Tomate pera');
assert.equal(normalized.productos[0].cantidad, 10);
assert.equal(normalized.productos[0].precio_unitario, 1.5);
assert.equal(normalized.productos[0].total_producto, 15);
assert.equal(normalized.productos[0].unidad, 'kg');

// product 2
assert.equal(normalized.productos[1].nombre_producto, 'Caja Fresas');
assert.equal(normalized.productos[1].cantidad, 2);
assert.equal(normalized.productos[1].precio_unitario, 12);
assert.equal(normalized.productos[1].total_producto, 24);
assert.equal(normalized.productos[1].unidad, 'caja');

// product 3
assert.equal(normalized.productos[2].nombre_producto, 'AGUA 1.5L');
assert.equal(normalized.productos[2].cantidad, 3);
assert.equal(normalized.productos[2].precio_unitario, 0.75);
assert.equal(normalized.productos[2].total_producto, 2.25);
assert.equal(normalized.productos[2].unidad, 'ud');

console.log('✅ normalizer tests passed');

