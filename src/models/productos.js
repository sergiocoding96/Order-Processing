import { supabaseAdmin } from '../config/database.js';
import { LocalDatabase } from '../config/local-database.js';
import logger from '../utils/logger.js';

// Flag to determine if we should use local database
let useLocalDB = false;

export class ProductosModel {
  static async createMany(pedidoId, productos) {
    // Try Supabase first, fallback to local DB on failure
    try {
      if (!useLocalDB) {
        const productosData = productos.map(producto => ({
          pedido_id: pedidoId,
          nombre_producto: producto.nombre_producto || producto.nombre,
          cantidad: producto.cantidad,
          unidad: producto.unidad,
          precio_unitario: producto.precio_unitario,
          total_producto: producto.total_producto || producto.precio_total
        }));

        const { data, error } = await supabaseAdmin
          .from('pedido_productos')
          .insert(productosData)
          .select();

        if (error) throw error;
        
        logger.info('Products created successfully (Supabase)', { 
          pedidoId, 
          productCount: data.length 
        });
        
        return data;
      }
    } catch (error) {
      logger.warn('Supabase failed, falling back to local database', { error: error.message });
      useLocalDB = true;
    }

    // Use local database
    return await LocalDatabase.createProductos(pedidoId, productos);
  }

  static async findByPedidoId(pedidoId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('pedido_productos')
        .select('*')
        .eq('pedido_id', pedidoId)
        .order('id', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error finding products by pedido ID', { pedidoId, error });
      throw error;
    }
  }

  static async update(id, updateData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('pedido_productos')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      logger.info('Product updated successfully', { productId: id });
      return data;
    } catch (error) {
      logger.error('Error updating product', { id, error });
      throw error;
    }
  }

  static async delete(id) {
    try {
      const { error } = await supabaseAdmin
        .from('pedido_productos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      logger.info('Product deleted successfully', { productId: id });
      return true;
    } catch (error) {
      logger.error('Error deleting product', { id, error });
      throw error;
    }
  }

  static async getTopProducts(filters = {}) {
    try {
      let query = supabaseAdmin
        .from('pedido_productos')
        .select(`
          nombre_producto,
          cantidad,
          total_producto,
          pedidos!inner(fecha_pedido, canal_origen)
        `);

      if (filters.fecha_desde) {
        query = query.gte('pedidos.fecha_pedido', filters.fecha_desde);
      }

      if (filters.fecha_hasta) {
        query = query.lte('pedidos.fecha_pedido', filters.fecha_hasta);
      }

      if (filters.canal_origen) {
        query = query.eq('pedidos.canal_origen', filters.canal_origen);
      }

      const { data, error } = await query.limit(filters.limit || 20);

      if (error) throw error;

      // Aggregate products by name
      const productStats = {};
      
      data.forEach(item => {
        const name = item.nombre_producto;
        if (!productStats[name]) {
          productStats[name] = {
            nombre_producto: name,
            total_cantidad: 0,
            total_value: 0,
            order_count: 0
          };
        }
        
        productStats[name].total_cantidad += parseFloat(item.cantidad || 0);
        productStats[name].total_value += parseFloat(item.total_producto || 0);
        productStats[name].order_count += 1;
      });

      // Convert to array and sort by total value
      const topProducts = Object.values(productStats)
        .sort((a, b) => b.total_value - a.total_value)
        .slice(0, filters.limit || 20);

      return topProducts;
    } catch (error) {
      logger.error('Error getting top products', { filters, error });
      throw error;
    }
  }
}