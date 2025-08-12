import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

export class XLSExporter {
    /**
     * Generate an Excel file from structured JSON using two layouts (invoice/order).
     */
    static async generateFromStructuredData(structured, outputDir = 'test_output') {
        try {
            const workbook = new ExcelJS.Workbook();

            const tipo = (structured?.tipo || structured?.Type || '').toLowerCase();
            const isInvoice = tipo === 'invoice';
            const sheet = workbook.addWorksheet(isInvoice ? 'Invoice' : 'Order');

            if (isInvoice) {
                // Invoice header (row 1)
                sheet.getRow(1).values = [
                    'Supplier', 'Invoice Date', 'Total Amount', 'Net Amount', 'Exchange Rate', 'Financing', 'Type'
                ];
                // Invoice meta (row 2)
                sheet.getRow(2).values = [
                    structured?.proveedor || structured?.supplier || structured?.cliente || '',
                    structured?.fecha_factura || structured?.fecha_pedido || '',
                    structured?.total_factura ?? structured?.total_pedido ?? null,
                    structured?.neto ?? null,
                    '',
                    '',
                    structured?.tipo || 'invoice'
                ];

                // Table headers (row 4) with canonical product code
                sheet.getRow(4).values = [
                    'ID', 'Product Code', 'Canonical Product Code', 'Description', 'Units', 'Unit Price', 'Batch Number', 'Amount'
                ];

                const items = Array.isArray(structured?.productos) ? structured.productos : [];
                items.forEach((it, idx) => {
                    const row = sheet.getRow(5 + idx);
                    row.getCell(1).value = idx + 1;
                    row.getCell(2).value = it.codigo || '';
                    row.getCell(3).value = it.codigo_canon || it.codigo || '';
                    row.getCell(4).value = it.nombre_producto || it.descripcion || '';
                    row.getCell(5).value = it.unidad || '';
                    row.getCell(6).value = it.precio_unitario ?? null;
                    row.getCell(7).value = it.lote || '';
                    row.getCell(8).value = it.total_producto ?? null;
                    row.commit();
                });
            } else {
                // Order layout per spec
                sheet.getRow(1).values = [
                    'Date', 'Client code', 'Client canonical code', 'Product code', 'Product canonical code', 'Product description', 'Units', 'Price', 'Type of price', 'Type'
                ];
                const items = Array.isArray(structured?.productos) ? structured.productos : [];
                items.forEach((it, idx) => {
                    const row = sheet.getRow(2 + idx);
                    row.getCell(1).value = structured?.fecha_pedido || structured?.fecha || '';
                    row.getCell(2).value = structured?.cliente_codigo || '';
                    row.getCell(3).value = structured?.cliente_codigo_canon || structured?.cliente_codigo || '';
                    row.getCell(4).value = it.codigo || '';
                    row.getCell(5).value = it.codigo_canon || it.codigo || '';
                    row.getCell(6).value = it.nombre_producto || it.descripcion || '';
                    row.getCell(7).value = it.cantidad ?? null;
                    row.getCell(8).value = it.precio_unitario ?? null;
                    row.getCell(9).value = '';
                    row.getCell(10).value = structured?.tipo || 'order';
                    row.commit();
                });
            }

            // Ensure output dir exists
            const outDir = path.resolve(outputDir);
            fs.mkdirSync(outDir, { recursive: true });

            const toSafe = (val) => String(val ?? '')
                .replace(/[^A-Za-z0-9._-]+/g, '_')
                .replace(/^_+|_+$/g, '')
                .slice(0, 80);
            const idPart = toSafe(structured?.numero_pedido || structured?.numero_factura || Date.now());
            const typePart = toSafe(structured?.tipo || structured?.Type || 'pedido');
            const filename = `${typePart}_${idPart}.xlsx`;
            const outPath = path.join(outDir, filename);

            await workbook.xlsx.writeFile(outPath);
            logger.info('XLS export created', { outPath });
            return { success: true, path: outPath };
        } catch (error) {
            logger.error('XLS export failed', error);
            return { success: false, error: error.message };
        }
    }

    static safeSetCell(sheet, address, value) {
        const cell = sheet.getCell(address);
        cell.value = value;
    }
}

export default XLSExporter;

