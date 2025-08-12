import { supabase, supabaseAdmin } from '../config/database.js';
import { LocalDatabase } from '../config/local-database.js';
import SecurityUtils from '../utils/security.js';
import logger from '../utils/logger.js';

// Flag to determine if we should use local database
let useLocalDB = false;

export class PedidosModel {
  static async create(orderData) {
    // Try Supabase first, fallback to local DB on failure
    try {
      if (!useLocalDB) {
        // Duplicate detection by numero_pedido (if provided)
        if (orderData.numero_pedido) {
          const existing = await supabaseAdmin
            .from('pedidos')
            .select('id, numero_pedido')
            .eq('numero_pedido', orderData.numero_pedido)
            .limit(1)
            .maybeSingle();
          if (existing && existing.data) {
            logger.info('Duplicate order detected, returning existing', { orderId: existing.data.id });
            return existing.data;
          }
        }

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
      // Use database function for better performance
      const { data, error } = await supabase
        .rpc('get_order_stats', {
          start_date: filters.fecha_desde || null,
          end_date: filters.fecha_hasta || null
        })
        .single();

      if (error) throw error;

      const stats = {
        total_orders: parseInt(data.total_orders) || 0,
        total_amount: parseFloat(data.total_amount) || 0,
        avg_order_value: parseFloat(data.avg_order_value) || 0,
        by_channel: data.orders_by_channel || {},
        by_status: data.orders_by_status || {}
      };

      logger.info('Order stats retrieved successfully', { 
        filters, 
        total_orders: stats.total_orders 
      });
      
      return stats;
    } catch (error) {
      logger.error('Error getting order stats', { filters, error });
      throw error;
    }
  }

  static async createWithProducts(orderData, products) {
    const client = supabaseAdmin;
    
    try {
      // Start transaction by creating order first
      const { data: order, error: orderError } = await client
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

      if (orderError) throw orderError;

      // Insert products if provided
      if (products && products.length > 0) {
        const productInserts = products.map(product => ({
          pedido_id: order.id,
          nombre_producto: product.nombre_producto,
          cantidad: product.cantidad,
          unidad: product.unidad,
          precio_unitario: product.precio_unitario,
          total_producto: product.total_producto
        }));

        const { error: productsError } = await client
          .from('pedido_productos')
          .insert(productInserts);

        if (productsError) {
          // If products fail, we could optionally delete the order
          // but for now we'll just log the error
          logger.error('Failed to insert products', { 
            orderId: order.id, 
            error: productsError 
          });
          throw productsError;
        }
      }

      logger.info('Order with products created successfully', { 
        orderId: order.id, 
        productsCount: products ? products.length : 0 
      });

      return order;
    } catch (error) {
      logger.error('Error creating order with products', { orderData, error });
      throw error;
    }
  }

  static async searchOrders(searchTerm, filters = {}) {
    try {
      let query = supabase
        .from('pedidos')
        .select(`
          *,
          pedido_productos (*)
        `);

      // SECURITY FIX: Sanitize search term to prevent SQL injection
      if (searchTerm) {
        const sanitizedTerm = SecurityUtils.sanitizeSQLParam(searchTerm);
        if (!sanitizedTerm) {
          throw new Error('Invalid search term');
        }
        
        // Use parameterized search to prevent injection
        query = query.or(`numero_pedido.ilike.%${sanitizedTerm}%,cliente.ilike.%${sanitizedTerm}%,observaciones.ilike.%${sanitizedTerm}%`);
      }

      // Apply filters
      if (filters.canal_origen) {
        query = query.eq('canal_origen', filters.canal_origen);
      }
      
      if (filters.estado) {
        query = query.eq('estado', filters.estado);
      }

      if (filters.fecha_desde) {
        query = query.gte('fecha_pedido', filters.fecha_desde);
      }

      if (filters.fecha_hasta) {
        query = query.lte('fecha_pedido', filters.fecha_hasta);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(filters.limit || 50);

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error searching orders', { searchTerm, filters, error });
      throw error;
    }
  }
}