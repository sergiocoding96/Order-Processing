import logger from './logger.js';

function toNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    const raw = String(value).trim();
    if (!raw) return null;

    // Keep digits, separators and sign
    let s = raw.replace(/[^0-9,.-]/g, '');

    const hasComma = s.includes(',');
    const hasDot = s.includes('.');

    // Determine decimal separator strategy
    if (hasComma && hasDot) {
        // Use the last occurring separator as decimal separator
        const lastComma = s.lastIndexOf(',');
        const lastDot = s.lastIndexOf('.');
        if (lastComma > lastDot) {
            // European style: '.' thousands, ',' decimal
            s = s.replace(/\./g, '').replace(/,/g, '.');
        } else {
            // US style: ',' thousands, '.' decimal
            s = s.replace(/,/g, '');
        }
    } else if (hasComma && !hasDot) {
        // Assume comma is decimal separator
        s = s.replace(/,/g, '.');
    } else if (hasDot && !hasComma) {
        // Dot as decimal separator; remove potential stray thousands spaces already removed
        // nothing additional needed
    }

    const num = parseFloat(s);
    return Number.isFinite(num) ? num : null;
}

function cleanString(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function normalizeDate(value) {
    const s = cleanString(value);
    if (!s) return null;
    // Accept DD/MM/YYYY or YYYY-MM-DD
    const dm = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dm) return `${dm[3]}-${dm[2]}-${dm[1]}`;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return s;
    return null;
}

const KNOWN_UNITS = new Set(['kg', 'kilogramo', 'kilogramos', 'ud', 'unidad', 'unidades', 'caja', 'cajas', 'litro', 'litros']);

function normalizeUnit(value) {
    const s = cleanString(value).toLowerCase();
    // discard if looks numeric
    if (/[-+]?\d/.test(s)) return '';
    if (KNOWN_UNITS.has(s)) return s;
    return s; // keep as-is if text
}

// Known client name variants → canonical client code
const CLIENT_CODE_MAP = {
    'alimarket alborada s.l': 'ALIMARKET_ALBORADA',
    'alimarket alborada': 'ALIMARKET_ALBORADA',
    'brunchit museo': 'BRUNCHIT_MUSEO',
    'leo1987 s.l': 'LEO1987',
    'leo foods': 'LEO1987'
};

function normalizeClientCode(name) {
    const s = cleanString(name).toLowerCase();
    if (!s) return '';
    return CLIENT_CODE_MAP[s] || s.replace(/[^a-z0-9]+/g, '_').toUpperCase();
}

function normalizeProductCode(code) {
    const s = cleanString(code).toUpperCase();
    // keep alphanumerics only
    return s.replace(/[^A-Z0-9]/g, '');
}

export function normalizeOrderData(extracted) {
    try {
        const data = { ...extracted };
        data.numero_pedido = cleanString(data.numero_pedido);
        data.cliente = cleanString(data.cliente);
        data.cliente_codigo = normalizeClientCode(data.cliente);
        data.fecha_pedido = normalizeDate(data.fecha_pedido) || data.fecha_pedido || null;
        data.total_pedido = toNumber(data.total_pedido);
        data.observaciones = cleanString(data.observaciones);
        data.tipo = data.tipo || '';

        const items = Array.isArray(data.productos) ? data.productos : [];
        data.productos = items.map((it) => {
            const nombre = cleanString(it.nombre_producto || it.descripcion || it.nombre);
            const codigo = normalizeProductCode(it.codigo || '');
            const cantidad = toNumber(it.cantidad);
            const precioUnit = toNumber(it.precio_unitario);
            let total = toNumber(it.total_producto);
            if (total === null && cantidad !== null && precioUnit !== null) {
                total = cantidad * precioUnit;
            }
            const unidad = normalizeUnit(it.unidad);
            return {
                nombre_producto: nombre,
                codigo,
                cantidad,
                unidad,
                precio_unitario: precioUnit,
                total_producto: total
            };
        });

        return data;
    } catch (error) {
        logger.warn('normalizeOrderData failed; returning input as-is', { error: error.message });
        return extracted;
    }
}

export default { normalizeOrderData };

