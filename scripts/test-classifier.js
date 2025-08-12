#!/usr/bin/env node
import { DocumentClassifier } from '../src/ai/classifier.js';

const tests = [
    {
        name: 'Invoice by CIF',
        text: 'LEO1987 S.L CIF B92694298 Factura Nº 12345 Cliente XYZ IVA 21% Total factura 123,45 €',
        expect: 'invoice'
    },
    {
        name: 'Invoice by keywords',
        text: 'Factura 2024-05-01 Número F-001 IVA incluido Neto 100,00 €',
        expect: 'invoice'
    },
    {
        name: 'Order by keywords',
        text: 'Pedido Nº O25080503UJ17 Cliente Brunchit Museo Productos: Oatly barista 2 cajas',
        expect: 'order'
    }
];

let pass = 0;
for (const t of tests) {
    const res = DocumentClassifier.classify(t.text);
    const ok = res.type === t.expect;
    console.log(`${ok ? '✅' : '❌'} ${t.name}: got ${res.type}, expected ${t.expect} (reason: ${res.reason})`);
    if (ok) pass++;
}

const summary = `${pass}/${tests.length} tests passed`;
console.log(summary);
process.exit(pass === tests.length ? 0 : 1);

