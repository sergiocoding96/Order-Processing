import { AIProcessor } from './ai-processor.js';
import { ContentDetector } from './content-detector.js';
import { PedidosModel } from '../models/pedidos.js';
import { ProductosModel } from '../models/productos.js';
import { normalizeOrderData } from '../utils/normalizer.js';
import { LogsModel } from '../models/logs.js';
import { CodeMatcher } from './code-matcher.js';
import XLSExporter from '../export/xlsExporter.js';
import { sendTelegramDocument, sendTelegramMessage } from './telegram-notifier.js';
import logger from '../utils/logger.js';

export class ProcessingQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxConcurrent = 3;
    this.currentlyProcessing = 0;
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  /**
   * Add item to processing queue
   */
  async addToQueue(webhookData, detection) {
    const queueItem = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      webhookData,
      detection,
      status: 'pending',
      attempts: 0,
      priority: ContentDetector.getProcessingPriority(detection),
      createdAt: Date.now()
    };

    this.queue.push(queueItem);
    this.sortQueue();

    logger.info('Item added to processing queue', {
      id: queueItem.id,
      priority: queueItem.priority,
      contentType: detection.primaryContent?.type,
      queueLength: this.queue.length
    });

    // Start processing if not already running
    if (!this.processing) {
      this.startProcessing();
    }

    return queueItem.id;
  }

  /**
   * Start processing queue
   */
  async startProcessing() {
    if (this.processing) return;

    this.processing = true;
    logger.info('Processing queue started');

    while (this.queue.length > 0 && this.currentlyProcessing < this.maxConcurrent) {
      const item = this.queue.shift();
      if (item && item.status === 'pending') {
        this.processItem(item);
      }
    }

    if (this.currentlyProcessing === 0) {
      this.processing = false;
      logger.info('Processing queue completed');
    }
  }

  /**
   * Process individual queue item
   */
  async processItem(item) {
    this.currentlyProcessing++;
    item.status = 'processing';
    item.attempts++;
    item.startedAt = Date.now();

    logger.info('Processing queue item', {
      id: item.id,
      attempt: item.attempts,
      contentType: item.detection.primaryContent?.type
    });
    await LogsModel.write('info', 'queue_item_started', { id: item.id, attempt: item.attempts, source: item.webhookData.source });

    try {
      // Check if content is processable
      const processability = ContentDetector.isProcessable(item.detection);
      if (!processability.processable) {
        throw new Error(`Content not processable: ${processability.reason}`);
      }

      // Prepare content data for AI processing
      const contentData = this.prepareContentData(item.webhookData, item.detection);

      // Process with AI
      const aiResult = await AIProcessor.processContent(item.detection, contentData);

      if (!aiResult.success) {
        throw new Error('AI processing failed');
      }

      // Validate extracted data
      const validation = AIProcessor.validateExtractedData(aiResult.extractedData);
      if (!validation.valid) {
        logger.warn('Extracted data validation failed', {
          id: item.id,
          errors: validation.errors
        });
        // Continue anyway but log warnings
      }

      // Normalize extracted data
      const normalized = normalizeOrderData(aiResult.extractedData);
      // Enrich with canonical codes via hybrid matcher (DB → Gemini → alias)
      const enriched = await CodeMatcher.enrichWithCanonicalCodes(normalized);

      // Save to database
      const savedOrder = await this.saveToDatabase(enriched, item.webhookData);

      // Mark as completed
      item.status = 'completed';
      item.completedAt = Date.now();
      item.processingTime = item.completedAt - item.startedAt;
      item.result = {
        orderId: savedOrder.id,
        confidence: aiResult.confidence,
        processingMethod: aiResult.processingMethod
      };

      logger.info('Queue item processed successfully', {
        id: item.id,
        orderId: savedOrder.id,
        processingTime: item.processingTime,
        confidence: aiResult.confidence
      });
      await LogsModel.write('info', 'queue_item_completed', { id: item.id, orderId: savedOrder.id, confidence: aiResult.confidence, source: item.webhookData.source });

      // Generate XLS and send Telegram confirmation if needed
      await this.sendProcessingConfirmation(item, savedOrder, enriched);

    } catch (error) {
      logger.error('Queue item processing failed', {
        id: item.id,
        attempt: item.attempts,
        error: error.message
      });
      await LogsModel.write('error', 'queue_item_failed', { id: item.id, attempt: item.attempts, error: error.message, source: item.webhookData.source });

      // Handle retry logic
      if (item.attempts < this.retryAttempts) {
        item.status = 'pending';
        item.retryAt = Date.now() + this.retryDelay;

        // Add back to queue for retry
        setTimeout(() => {
          this.queue.unshift(item);
          this.sortQueue();
          if (!this.processing) {
            this.startProcessing();
          }
        }, this.retryDelay);

        logger.info('Queue item scheduled for retry', {
          id: item.id,
          nextAttempt: item.attempts + 1,
          retryIn: this.retryDelay / 1000 + ' seconds'
        });
        await LogsModel.write('warn', 'queue_item_retry_scheduled', { id: item.id, nextAttempt: item.attempts + 1, retryInMs: this.retryDelay, source: item.webhookData.source });
      } else {
        // Max retries reached, mark as failed
        item.status = 'failed';
        item.error = error.message;
        item.failedAt = Date.now();

        logger.error('Queue item failed permanently', {
          id: item.id,
          error: error.message,
          attempts: item.attempts
        });
        await LogsModel.write('error', 'queue_item_failed_permanently', { id: item.id, attempts: item.attempts, error: error.message, source: item.webhookData.source });

        // Optionally send failure notification
        await this.sendProcessingFailure(item, error);
      }
    } finally {
      this.currentlyProcessing--;

      // Continue processing queue
      if (this.queue.length > 0 && this.currentlyProcessing < this.maxConcurrent) {
        setTimeout(() => this.startProcessing(), 100);
      } else if (this.currentlyProcessing === 0) {
        this.processing = false;
      }
    }
  }

  /**
   * Prepare content data for AI processing
   */
  prepareContentData(webhookData, detection) {
    const contentData = {};

    if (webhookData.source === 'mailhook') {
      // Email data from mailhook
      if (webhookData.body) {
        contentData.text = webhookData.body;
      }
      if (webhookData.attachments && webhookData.attachments.length > 0) {
        // Use the first attachment (they're already validated)
        const attachment = webhookData.attachments[0];
        if (attachment) {
          contentData.filePath = attachment.path;
          contentData.attachmentType = attachment.mimetype || 'application/pdf';
          contentData.filename = attachment.filename || attachment.originalname;
        }
      }
    } else if (webhookData.source === 'telegram') {
      // Telegram message data
      if (webhookData.text) {
        contentData.text = webhookData.text;
      }
      if (webhookData.url) {
        contentData.url = webhookData.url;
      }
      if (webhookData.document) {
        contentData.telegramFile = webhookData.document;
      }
      if (webhookData.photo) {
        contentData.telegramPhoto = webhookData.photo;
      }
    }

    return contentData;
  }

  /**
   * Save extracted data to database
   */
  async saveToDatabase(extractedData, webhookData) {
    try {
      // Create order record
      const orderData = {
        numero_pedido: extractedData.numero_pedido || `AUTO-${Date.now()}`,
        cliente: extractedData.cliente || 'Cliente desconocido',
        fecha_pedido: extractedData.fecha_pedido || new Date().toISOString().split('T')[0],
        canal_origen: webhookData.source,
        total_pedido: extractedData.total_pedido || 0,
        observaciones: extractedData.observaciones || '',
        estado: 'procesado',
        metadata: {
          processing: {
            confidence: this.calculateConfidence(extractedData),
            source: webhookData.source,
            processedAt: new Date().toISOString()
          },
          original: {
            messageId: webhookData.metadata?.messageId || webhookData.messageId,
            sender: webhookData.sender || webhookData.username
          }
        }
      };

      const savedOrder = await PedidosModel.create(orderData);

      // Create product records
      if (extractedData.productos && extractedData.productos.length > 0) {
        await ProductosModel.createMany(savedOrder.id, extractedData.productos);
      }

      logger.info('Order saved to database', {
        orderId: savedOrder.id,
        productCount: extractedData.productos?.length || 0,
        totalAmount: extractedData.total_pedido
      });

      return savedOrder;
    } catch (error) {
      logger.error('Database save failed', error);
      throw error;
    }
  }

  /**
   * Send processing confirmation
   */
  async sendProcessingConfirmation(item, savedOrder, enrichedData) {
    try {
      if (item.webhookData.source === 'telegram' && item.webhookData.chatId) {
        // Auto-export XLS for Telegram confirmation
        try {
          const dataForXls = { ...enrichedData, tipo: enrichedData?.tipo || 'order' };
          const xls = await XLSExporter.generateFromStructuredData(dataForXls, process.env.XLS_OUTPUT_DIR || 'Test Files Leo Output');
          if (xls?.success) {
            await sendTelegramDocument(item.webhookData.chatId, xls.path, {
              filename: xls.path.split('/').pop(),
              caption: `✅ Procesado. Pedido/Factura ID ${savedOrder.id}`,
              contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
          } else {
            await sendTelegramMessage(item.webhookData.chatId, `✅ Procesado. ID ${savedOrder.id}. (No se pudo adjuntar XLS)`);
          }
        } catch (attachErr) {
          logger.warn('Failed to generate/send XLS to Telegram', { error: attachErr.message });
          await sendTelegramMessage(item.webhookData.chatId, `✅ Procesado. ID ${savedOrder.id}.`);
        }
      }
    } catch (error) {
      logger.error('Failed to send processing confirmation', error);
    }
  }

  /**
   * Send processing failure notification
   */
  async sendProcessingFailure(item, error) {
    try {
      logger.warn('Processing failed, notification needed', {
        id: item.id,
        source: item.webhookData.source,
        error: error.message
      });
      if (item.webhookData.source === 'telegram' && item.webhookData.chatId) {
        await sendTelegramMessage(item.webhookData.chatId, `❌ Error procesando: ${error.message}`);
      }
    } catch (notificationError) {
      logger.error('Failed to send failure notification', notificationError);
    }
  }

  /**
   * Sort queue by priority (lower number = higher priority)
   */
  sortQueue() {
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // If same priority, sort by creation time (FIFO)
      return a.createdAt - b.createdAt;
    });
  }

  /**
   * Generate unique ID for queue item
   */
  generateId() {
    return 'queue_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      currentlyProcessing: this.currentlyProcessing,
      totalProcessed: this.getTotalProcessed(),
      failed: this.getTotalFailed()
    };
  }

  /**
   * Get total processed items (this session)
   */
  getTotalProcessed() {
    // In a real implementation, this would be stored in database or memory store
    return 0;
  }

  /**
   * Get total failed items (this session)
   */
  getTotalFailed() {
    // In a real implementation, this would be stored in database or memory store
    return 0;
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(extractedData) {
    // Use the same logic as AIProcessor
    return AIProcessor.calculateConfidence(extractedData);
  }
}

// Create singleton instance
export const processingQueue = new ProcessingQueue();

export default ProcessingQueue;