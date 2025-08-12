#!/usr/bin/env node
import ExcelJS from 'exceljs';
import fs from 'fs';

function eqArr(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if ((a[i] ?? '') !== (b[i] ?? '')) return false;
    }
    return true;
}

async function verifyInvoice(file) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file);
    const sheet = workbook.worksheets[0];

    const header1 = sheet.getRow(1).values.slice(1); // drop index 0
    const expectedHeader1 = ['Supplier', 'Invoice Date', 'Total Amount', 'Net Amount', 'Exchange Rate', 'Financing', 'Type'];
    const header2 = sheet.getRow(4).values.slice(1);
    const expectedHeader2 = ['ID', 'Product Code', 'Description', 'Units', 'Unit Price', 'Batch Number', 'Amount'];

    const typeCell = sheet.getRow(2).getCell(7).value; // G2

    const ok = eqArr(header1, expectedHeader1) && eqArr(header2, expectedHeader2) && (typeCell === 'invoice' || typeCell === 'Invoice');
    return { ok, header1, header2, typeCell };
}

async function verifyOrder(file) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file);
    const sheet = workbook.worksheets[0];

    const header1 = sheet.getRow(1).values.slice(1);
    const expectedHeader1 = ['Date', 'Client code', 'Product code', 'Product description', 'Units', 'Price', 'Type of price', 'Type'];

    const typeCell = sheet.getRow(2).getCell(8).value; // H2
    const ok = eqArr(header1, expectedHeader1) && (typeCell === 'order' || typeCell === 'Order');
    return { ok, header1, typeCell };
}

async function main() {
    const files = process.argv.slice(2);
    if (files.length === 0) {
        console.error('Usage: node scripts/verify-xls-formats.js <file1.xlsx> [file2.xlsx] ...');
        process.exit(2);
    }

    let allOk = true;
    for (const f of files) {
        if (!fs.existsSync(f)) {
            console.error('File not found:', f);
            allOk = false;
            continue;
        }
        const isInvoice = /invoice/i.test(f);
        try {
            const result = isInvoice ? await verifyInvoice(f) : await verifyOrder(f);
            console.log(JSON.stringify({ file: f, expectedType: isInvoice ? 'invoice' : 'order', ...result }, null, 2));
            if (!result.ok) allOk = false;
        } catch (e) {
            console.error('Verification error for', f, e.message || e);
            allOk = false;
        }
    }

    process.exit(allOk ? 0 : 1);
}

main();

