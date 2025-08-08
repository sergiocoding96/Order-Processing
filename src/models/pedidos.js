import { supabase, supabaseAdmin } from '../config/database.js';
import { LocalDatabase } from '../config/local-database.js';
import logger from '../utils/logger.js';

// Flag to determine if we should use local database
let useLocalDB = false;

export class PedidosModel {
  static async create(orderData) {
    // Try Supabase first, fallback to local DB on failure
    try {
      if (!useLocalDB) {
        const { data, error } = await supabaseAdmin
          .from('pedidos')
          .insert({
            numero_pedido: orderData.numero_pedido,
            cliente: orderData.cliente,
            fecha_pedido: orderData.fecha_pedido,
            canal_origen: orderData.canal_origen,
            total_pedido: orderData.total_pedido,
            observaciones: orderData.observaciones,
            estado: orderData.estado || 'procesado',
            metadata: orderData.metadata || {}
          })
          .select()
          .single();

        if (error) throw error;
        
        logger.info('Order created successfully (Supabase)', { orderId: data.id });
        return data;
      }
    } catch (error) {
      logger.warn('Supabase failed, falling back to local database', { error: error.message });
      useLocalDB = true;
    }

    // Use local database
    return await LocalDatabase.createPedido(orderData);
  }

  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          *,
          pedido_productos (*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error finding order by ID', { id, error });
      throw error;
    }
  }

  static async findAll(filters = {}) {
    try {
      let query = supabase
        .from('pedidos')
        .select(`
          *,
          pedido_productos (*)
        `);

      if (filters.canal_origen) {
        query = query.eq('canal_origen', filters.canal_origen);
      }

      if (filters.fecha_desde) {
        query = query.gte('fecha_pedido', filters.fecha_desde);
      }

      if (filters.fecha_hasta) {
        query = query.lte('fecha_pedido', filters.fecha_hasta);
      }

      if (filters.estado) {
        query = query.eq('estado', filters.estado);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(filters.limit || 100);

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error finding orders', { filters, error });
      throw error;
    }
  }

  static async update(id, updateData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('pedidos')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      logger.info('Order updated successfully', { orderId: id });
      return data;
    } catch (error) {
      logger.error('Error updating order', { id, error });
      throw error;
    }
  }

  static async delete(id) {
    try {
      const { error } = await supabaseAdmin
        .from('pedidos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      logger.info('Order deleted successfully', { orderId: id });
      return true;
    } catch (error) {
      logger.error('Error deleting order', { id, error });
      throw error;
    }
  }

  static async getStats(filters = {}) {
    try {
      let query = supabase
        .from('pedidos')
        .select('total_pedido, canal_origen, fecha_pedido, estado');

      if (filters.fecha_desde) {
        query = query.gte('fecha_pedido', filters.fecha_desde);
      }

      if (filters.fecha_hasta) {
        query = query.lte('fecha_pedido', filters.fecha_hasta);
      }

      const { data, error } = await query;

      if (error) throw error;

      const stats = {
        total_orders: data.length,
        total_amount: data.reduce((sum, order) => sum + parseFloat(order.total_pedido || 0), 0),
        by_channel: {},
        by_status: {},
        avg_order_value: 0
      };

      data.forEach(order => {
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
      logger.error('Error getting order stats', { filters, error });
      throw error;
    }
  }
}