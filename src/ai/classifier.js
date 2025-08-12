import logger from '../utils/logger.js';

export class DocumentClassifier {
    static getLeosCIF() {
        return process.env.LEOS_FOODS_CIF?.trim() || '';
    }

    /**
     * Classify a document as 'invoice' or 'order' based on cues in text.
     * - Primary cue: presence of Leo's CIF → invoice
     * - Secondary cues: keywords for invoice vs order
     */
    static classify(text) {
        try {
            const source = text || '';
            const normalized = source.toLowerCase();

            const leosCif = this.getLeosCIF().toLowerCase();
            const hasLeosCif = leosCif && normalized.includes(leosCif);

            if (hasLeosCif) {
                return { type: 'invoice', reason: 'cif_match' };
            }

            const invoiceKeywords = [
                'factura',
                'invoice',
                'nº factura',
                'nºfactura',
                'num factura',
                'iva',
                'tax rate',
                'total factura'
            ];
            const orderKeywords = [
                'pedido',
                'order',
                'nº pedido',
                'po',
                'orden de compra',
                'purchase order'
            ];

            const score = {
                invoice: 0,
                order: 0
            };

            for (const kw of invoiceKeywords) {
                if (normalized.includes(kw)) score.invoice += 1;
            }
            for (const kw of orderKeywords) {
                if (normalized.includes(kw)) score.order += 1;
            }

            const type = score.invoice > score.order ? 'invoice' : 'order';
            const reason = score.invoice > score.order ? 'invoice_keywords' : 'order_keywords';

            return { type, reason, score };
        } catch (error) {
            logger.error('Document classification failed', error);
            return { type: 'order', reason: 'error_default_order' };
        }
    }
}

export default DocumentClassifier;

