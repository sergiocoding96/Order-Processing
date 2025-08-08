// Simple local JSON database for development and testing
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(path.dirname(__dirname), '..', 'data');
const PEDIDOS_FILE = path.join(DB_PATH, 'pedidos.json');
const PRODUCTOS_FILE = path.join(DB_PATH, 'productos.json');

// Ensure data directory exists
if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH, { recursive: true });
}

// Initialize files if they don't exist
if (!fs.existsSync(PEDIDOS_FILE)) {
  fs.writeFileSync(PEDIDOS_FILE, JSON.stringify([], null, 2));
}

if (!fs.existsSync(PRODUCTOS_FILE)) {
  fs.writeFileSync(PRODUCTOS_FILE, JSON.stringify([], null, 2));
}

export class LocalDatabase {
  static readPedidos() {
    try {
      const data = fs.readFileSync(PEDIDOS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error reading pedidos file', error);
      return [];
    }
  }

  static writePedidos(pedidos) {
    try {
      fs.writeFileSync(PEDIDOS_FILE, JSON.stringify(pedidos, null, 2));
      return true;
    } catch (error) {
      logger.error('Error writing pedidos file', error);
      return false;
    }
  }

  static readProductos() {
    try {
      const data = fs.readFileSync(PRODUCTOS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error reading productos file', error);
      return [];
    }
  }

  static writeProductos(productos) {
    try {
      fs.writeFileSync(PRODUCTOS_FILE, JSON.stringify(productos, null, 2));
      return true;
    } catch (error) {
      logger.error('Error writing productos file', error);
      return false;
    }
  }

  static generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // Pedidos operations
  static async createPedido(orderData) {
    try {
      const pedidos = this.readPedidos();
      const newPedido = {
        id: this.generateId(),
        numero_pedido: orderData.numero_pedido,
        cliente: orderData.cliente,
        fecha_pedido: orderData.fecha_pedido,
        canal_origen: orderData.canal_origen,
        total_pedido: orderData.total_pedido,
        observaciones: orderData.observaciones,
        estado: orderData.estado || 'procesado',
        metadata: orderData.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      pedidos.push(newPedido);
      this.writePedidos(pedidos);

      logger.info('Order created successfully (local DB)', { orderId: newPedido.id });
      return newPedido;
    } catch (error) {
      logger.error('Error creating order (local DB)', error);
      throw error;
    }
  }

  static async findPedidoById(id) {
    try {
      const pedidos = this.readPedidos();
      const pedido = pedidos.find(p => p.id === id);
      
      if (pedido) {
        // Get associated products
        const productos = this.readProductos();
        pedido.pedido_productos = productos.filter(p => p.pedido_id === id);
      }

      return pedido;
    } catch (error) {
      logger.error('Error finding pedido by ID (local DB)', { id, error });
      throw error;
    }
  }

  static async findAllPedidos(filters = {}) {
    try {
      let pedidos = this.readPedidos();
      const productos = this.readProductos();

      // Apply filters
      if (filters.canal_origen) {
        pedidos = pedidos.filter(p => p.canal_origen === filters.canal_origen);
      }

      if (filters.fecha_desde) {
        pedidos = pedidos.filter(p => p.fecha_pedido >= filters.fecha_desde);
      }

      if (filters.fecha_hasta) {
        pedidos = pedidos.filter(p => p.fecha_pedido <= filters.fecha_hasta);
      }

      if (filters.estado) {
        pedidos = pedidos.filter(p => p.estado === filters.estado);
      }

      // Add associated products
      pedidos.forEach(pedido => {
        pedido.pedido_productos = productos.filter(p => p.pedido_id === pedido.id);
      });

      // Sort by created_at desc
      pedidos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // Apply limit
      if (filters.limit) {
        pedidos = pedidos.slice(0, filters.limit);
      }

      return pedidos;
    } catch (error) {
      logger.error('Error finding pedidos (local DB)', { filters, error });
      throw error;
    }
  }

  // Productos operations
  static async createProductos(pedidoId, productos) {
    try {
      const existingProductos = this.readProductos();
      const newProductos = productos.map(producto => ({
        id: this.generateId(),
        pedido_id: pedidoId,
        nombre: producto.nombre,
        cantidad: producto.cantidad,
        precio_unitario: producto.precio_unitario,
        precio_total: producto.precio_total,
        unidad: producto.unidad,
        observaciones: producto.observaciones || '',
        created_at: new Date().toISOString()
      }));

      existingProductos.push(...newProductos);
      this.writeProductos(existingProductos);

      logger.info('Products created successfully (local DB)', { 
        pedidoId, 
        productCount: newProductos.length 
      });
      
      return newProductos;
    } catch (error) {
      logger.error('Error creating products (local DB)', { pedidoId, error });
      throw error;
    }
  }

  // Stats
  static async getStats(filters = {}) {
    try {
      const pedidos = await this.findAllPedidos(filters);
      
      const stats = {
        total_orders: pedidos.length,
        total_amount: pedidos.reduce((sum, order) => sum + parseFloat(order.total_pedido || 0), 0),
        by_channel: {},
        by_status: {},
        avg_order_value: 0
      };

      pedidos.forEach(order => {
        // By channel
        stats.by_channel[order.canal_origen] = 
          (stats.by_channel[order.canal_origen] || 0) + 1;
        
        // By status
        stats.by_status[order.estado] = 
          (stats.by_status[order.estado] || 0) + 1;
      });

      stats.avg_order_value = stats.total_orders > 0 
        ? stats.total_amount / stats.total_orders 
        : 0;

      return stats;
    } catch (error) {
      logger.error('Error getting stats (local DB)', { filters, error });
      throw error;
    }
  }

  // Test connection
  static async testConnection() {
    try {
      const pedidos = this.readPedidos();
      console.log('✅ Local database connection successful');
      console.log(`📊 Current orders in database: ${pedidos.length}`);
      return true;
    } catch (error) {
      console.error('❌ Local database connection failed:', error.message);
      return false;
    }
  }
}

export default LocalDatabase;