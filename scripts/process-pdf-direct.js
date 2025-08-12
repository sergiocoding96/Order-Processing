#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import PDFProcessor from '../src/services/pdf-processor.js';

dotenv.config();

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: node scripts/process-pdf-direct.js <absolute_path_to_pdf> [output_dir]');
        process.exit(1);
    }

    const pdfPath = args[0];
    const outDir = args[1] || 'Test Files Leo Output';

    if (!path.isAbsolute(pdfPath)) {
        console.error('Please provide an absolute path to the PDF.');
        process.exit(1);
    }

    if (!fs.existsSync(pdfPath)) {
        console.error('PDF file not found:', pdfPath);
        process.exit(1);
    }

    try {
        const result = await PDFProcessor.processPDF(pdfPath, { generateXLS: true, outputDir: outDir });
        console.log('Processing result:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Direct processing failed:', err.message || err);
        process.exit(1);
    }
}

main();

