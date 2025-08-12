import { supabaseAdmin } from '../config/database.js';
import { processWithGemini } from '../config/ai.js';
import logger from '../utils/logger.js';

async function safeSelect(table, columns, filters = []) {
    try {
        let q = supabaseAdmin.from(table).select(columns);
        for (const f of filters) {
            q = q.eq(f.key, f.value);
        }
        const { data, error } = await q;
        if (error) throw error;
        return { ok: true, data };
    } catch (error) {
        logger.warn(`DB select failed on ${table}`, { error: error.message });
        return { ok: false, data: [] };
    }
}

async function safeInsert(table, payload) {
    try {
        const { error } = await supabaseAdmin.from(table).insert(payload);
        if (error) throw error;
        return true;
    } catch (error) {
        logger.warn(`DB insert failed on ${table}`, { error: error.message });
        return false;
    }
}

export class CodeMatcher {
    static async loadCandidateCodes() {
        const clients = await safeSelect('clients', 'code');
        const products = await safeSelect('products', 'code');
        return {
            clientCodes: clients.ok ? clients.data.map(r => r.code) : [],
            productCodes: products.ok ? products.data.map(r => r.code) : []
        };
    }

    static async matchClient({ name, normalizedCode }) {
        const result = { canonical: null, status: 'unmatched', confidence: 0.0 };
        const code = (normalizedCode || '').toUpperCase();
        const alias = (name || '').trim().toLowerCase();

        // Exact code match
        if (code) {
            const exact = await safeSelect('clients', 'id, code', [{ key: 'code', value: code }]);
            if (exact.ok && exact.data.length > 0) {
                return { canonical: exact.data[0].code, status: 'matched', confidence: 1.0 };
            }
        }

        // Alias match
        if (alias) {
            const byAlias = await safeSelect('client_aliases', 'client_id, alias', [{ key: 'alias', value: alias }]);
            if (byAlias.ok && byAlias.data.length > 0) {
                const clientId = byAlias.data[0].client_id;
                const client = await safeSelect('clients', 'code', [{ key: 'id', value: clientId }]);
                if (client.ok && client.data.length > 0) {
                    return { canonical: client.data[0].code, status: 'alias', confidence: 1.0 };
                }
            }
        }

        // Gemini fallback
        try {
            const { clientCodes } = await this.loadCandidateCodes();
            if (clientCodes.length > 0) {
                const prompt = `You are a strict matcher. Choose the best canonical client code from the list.
Input name: "${name}"
Normalized code: "${code}"
Available codes: ${JSON.stringify(clientCodes)}
Return ONLY JSON with keys matched_code, confidence (0..1), reason.`;
                const resp = await processWithGemini(prompt, { responseFormat: { type: 'json_object' }, maxTokens: 300 });
                const data = JSON.parse(resp.content);
                if (data?.matched_code && data?.confidence >= 0.9 && clientCodes.includes(data.matched_code)) {
                    // Auto-create alias for future exact match
                    if (alias) {
                        await safeInsert('client_aliases', { client_id: null, alias });
                    }
                    return { canonical: data.matched_code, status: 'ai', confidence: data.confidence };
                }
            }
        } catch (e) {
            logger.warn('Gemini client match failed', { error: e.message });
        }

        return result;
    }

    static async matchProduct({ name, normalizedCode }) {
        const code = (normalizedCode || '').toUpperCase();
        const alias = (name || '').trim().toLowerCase();

        if (code) {
            const exact = await safeSelect('products', 'id, code', [{ key: 'code', value: code }]);
            if (exact.ok && exact.data.length > 0) {
                return { canonical: exact.data[0].code, status: 'matched', confidence: 1.0 };
            }
        }

        if (alias) {
            const byAlias = await safeSelect('product_aliases', 'product_id, alias', [{ key: 'alias', value: alias }]);
            if (byAlias.ok && byAlias.data.length > 0) {
                const productId = byAlias.data[0].product_id;
                const product = await safeSelect('products', 'code', [{ key: 'id', value: productId }]);
                if (product.ok && product.data.length > 0) {
                    return { canonical: product.data[0].code, status: 'alias', confidence: 1.0 };
                }
            }
        }

        try {
            const { productCodes } = await this.loadCandidateCodes();
            if (productCodes.length > 0) {
                const prompt = `You are a strict matcher. Choose the best canonical product code from the list.
Input name: "${name}"
Normalized code: "${code}"
Available codes: ${JSON.stringify(productCodes)}
Return ONLY JSON with keys matched_code, confidence (0..1), reason.`;
                const resp = await processWithGemini(prompt, { responseFormat: { type: 'json_object' }, maxTokens: 300 });
                const data = JSON.parse(resp.content);
                if (data?.matched_code && data?.confidence >= 0.9 && productCodes.includes(data.matched_code)) {
                    if (alias) {
                        await safeInsert('product_aliases', { product_id: null, alias });
                    }
                    return { canonical: data.matched_code, status: 'ai', confidence: data.confidence };
                }
            }
        } catch (e) {
            logger.warn('Gemini product match failed', { error: e.message });
        }

        return { canonical: null, status: 'unmatched', confidence: 0.0 };
    }

    static async enrichWithCanonicalCodes(orderData) {
        try {
            const enriched = { ...orderData };

            // Client
            const clientMatch = await this.matchClient({ name: enriched.cliente, normalizedCode: enriched.cliente_codigo });
            enriched.cliente_codigo_canon = clientMatch.canonical || enriched.cliente_codigo || null;
            enriched.cliente_match_status = clientMatch.status;
            enriched.cliente_match_confidence = clientMatch.confidence;

            // Products
            const items = Array.isArray(enriched.productos) ? enriched.productos : [];
            enriched.productos = [];
            for (const it of items) {
                const prodMatch = await this.matchProduct({ name: it.nombre_producto, normalizedCode: it.codigo });
                enriched.productos.push({
                    ...it,
                    codigo_canon: prodMatch.canonical || it.codigo || null,
                    product_match_status: prodMatch.status,
                    product_match_confidence: prodMatch.confidence
                });
            }

            return enriched;
        } catch (error) {
            logger.warn('enrichWithCanonicalCodes failed', { error: error.message });
            return orderData;
        }
    }
}

export default CodeMatcher;

