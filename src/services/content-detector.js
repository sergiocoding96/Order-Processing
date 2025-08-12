import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';

export class ContentDetector {

  /**
   * Detect content type from various inputs
   * @param {Object} input - Input data from webhook
   * @returns {Object} Detection result
   */
  static detect(input) {
    try {
      const detection = {
        timestamp: new Date().toISOString(),
        source: input.source || 'unknown',
        contentTypes: [],
        primaryContent: null,
        metadata: {}
      };

      // Detect content based on source
      if (input.source === 'outlook') {
        return this.detectOutlookContent(input, detection);
      } else if (input.source === 'telegram') {
        return this.detectTelegramContent(input, detection);
      } else if (input.source === 'mailhook') {
        return this.detectMailhookContent(input, detection);
      }

      return detection;
    } catch (error) {
      logger.error('Content detection failed', error);
      throw error;
    }
  }

  /**
   * Detect content from Outlook webhook
   */
  static detectOutlookContent(input, detection) {
    // Check for attachments first
    if (input.attachments && input.attachments.length > 0) {
      input.attachments.forEach((attachment, index) => {
        const contentType = this.detectFileType(attachment);
        detection.contentTypes.push({
          type: contentType.type,
          confidence: contentType.confidence,
          source: 'attachment',
          index: index,
          filename: attachment.originalname || attachment.name,
          size: attachment.size,
          mimeType: attachment.mimetype
        });
      });

      // Set primary content to first PDF or first attachment
      const pdfAttachment = detection.contentTypes.find(ct => ct.type === 'pdf');
      const firstAttachment = detection.contentTypes[0];
      detection.primaryContent = pdfAttachment || firstAttachment;
    }

    // Check email body content
    if (input.body && input.body.trim().length > 0) {
      const bodyType = this.detectTextContent(input.body);
      detection.contentTypes.push({
        type: bodyType.type,
        confidence: bodyType.confidence,
        processor: bodyType.processor,
        description: bodyType.description,
        source: 'email_body',
        content: input.body,
        urls: bodyType.urls || [],
        bodyType: input.bodyType || 'text'
      });

      // If no attachments, body becomes primary
      if (!detection.primaryContent) {
        detection.primaryContent = detection.contentTypes[detection.contentTypes.length - 1];
      }
    }

    // Add metadata
    detection.metadata = {
      subject: input.subject,
      sender: input.sender,
      messageId: input.metadata?.messageId,
      receivedDateTime: input.metadata?.receivedDateTime
    };

    return detection;
  }

  /**
   * Detect content from Mailhook webhook
   */
  static detectMailhookContent(input, detection) {

    // Check for attachments first
    if (input.attachments && input.attachments.length > 0) {
      input.attachments.forEach((attachment, index) => {
        const contentType = this.detectFileType(attachment);
        detection.contentTypes.push({
          type: contentType.type,
          confidence: contentType.confidence,
          processor: contentType.processor,
          description: contentType.description,
          source: 'attachment',
          index: index,
          filename: attachment.originalname || attachment.filename,
          size: attachment.size,
          mimeType: attachment.mimetype
        });
      });

      // Set primary content to first PDF or first attachment
      const pdfAttachment = detection.contentTypes.find(ct => ct.type === 'pdf');
      const firstAttachment = detection.contentTypes[0];
      detection.primaryContent = pdfAttachment || firstAttachment;
    }

    // Check email body content
    if (input.body && input.body.trim().length > 0) {
      const bodyType = this.detectTextContent(input.body);
      detection.contentTypes.push({
        type: bodyType.type,
        confidence: bodyType.confidence,
        processor: bodyType.processor,
        description: bodyType.description,
        source: 'email_body',
        content: input.body,
        urls: bodyType.urls || []
      });

      // If no attachments, body becomes primary
      if (!detection.primaryContent) {
        detection.primaryContent = detection.contentTypes[detection.contentTypes.length - 1];
      }
    }

    // Add metadata
    detection.metadata = {
      subject: input.subject,
      from: input.from,
      to: input.to,
      messageId: input.messageId,
      receivedAt: input.timestamp
    };

    return detection;
  }

  /**
   * Detect content from Telegram webhook
   */
  static detectTelegramContent(input, detection) {
    // Handle different Telegram message types
    if (input.document) {
      const contentType = this.detectFileType(input.document);
      detection.contentTypes.push({
        type: contentType.type,
        confidence: contentType.confidence,
        source: 'telegram_document',
        fileId: input.document.fileId,
        filename: input.document.fileName,
        size: input.document.fileSize,
        mimeType: input.document.mimeType
      });
      detection.primaryContent = detection.contentTypes[0];
    }

    if (input.photo) {
      detection.contentTypes.push({
        type: 'image',
        confidence: 0.95,
        source: 'telegram_photo',
        fileId: input.photo.file_id,
        size: input.photo.file_size,
        width: input.photo.width,
        height: input.photo.height
      });
      if (!detection.primaryContent) {
        detection.primaryContent = detection.contentTypes[0];
      }
    }

    if (input.url) {
      const urlType = this.detectUrlContent(input.url);
      detection.contentTypes.push({
        type: urlType.type,
        confidence: urlType.confidence,
        source: 'telegram_url',
        url: input.url
      });
      if (!detection.primaryContent) {
        detection.primaryContent = detection.contentTypes[0];
      }
    }

    if (input.text && input.text.trim().length > 0) {
      const textType = this.detectTextContent(input.text);
      detection.contentTypes.push({
        type: textType.type,
        confidence: textType.confidence,
        processor: textType.processor,
        description: textType.description,
        source: 'telegram_text',
        content: input.text
      });
      if (!detection.primaryContent) {
        detection.primaryContent = detection.contentTypes[detection.contentTypes.length - 1];
      }
    }

    // Add metadata
    detection.metadata = {
      chatId: input.chatId,
      userId: input.userId,
      username: input.username,
      messageId: input.messageId,
      updateId: input.updateId
    };

    return detection;
  }

  /**
   * Detect file type and processing method
   */
  static detectFileType(file) {
    const filename = file.originalname || file.fileName || file.name || '';
    const mimeType = file.mimetype || file.mimeType || '';
    const extension = path.extname(filename).toLowerCase();

    // PDF files - use streamlined processing (GPT-5 Vision + DeepSeek R1)
    if (extension === '.pdf' || mimeType.includes('pdf')) {
      return {
        type: 'pdf',
        confidence: 0.95,
        processor: 'gpt5-vision',
        description: 'PDF document requiring streamlined processing (GPT-5 Vision + DeepSeek R1)'
      };
    }

    // Image files
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    if (imageExtensions.includes(extension) || mimeType.startsWith('image/')) {
      return {
        type: 'image',
        confidence: 0.9,
        processor: 'gpt5-vision',
        description: 'Image file requiring GPT-5 Vision analysis'
      };
    }

    // Document files
    const docExtensions = ['.doc', '.docx', '.txt', '.rtf'];
    if (docExtensions.includes(extension) || mimeType.includes('document')) {
      return {
        type: 'document',
        confidence: 0.85,
        processor: 'document-processor',
        description: 'Text document requiring content extraction'
      };
    }

    // Spreadsheet files
    const spreadsheetExtensions = ['.xls', '.xlsx', '.csv'];
    if (spreadsheetExtensions.includes(extension) || mimeType.includes('sheet')) {
      return {
        type: 'spreadsheet',
        confidence: 0.8,
        processor: 'spreadsheet-processor',
        description: 'Spreadsheet requiring data extraction'
      };
    }

    return {
      type: 'unknown',
      confidence: 0.1,
      processor: 'manual-review',
      description: 'Unknown file type requiring manual review'
    };
  }

  /**
   * Detect URL content type
   */
  static detectUrlContent(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname.toLowerCase();

      // E-commerce or order-related sites
      const orderSites = ['amazon', 'ebay', 'mercadolibre', 'aliexpress', 'shopify'];
      if (orderSites.some(site => hostname.includes(site))) {
        return {
          type: 'ecommerce_url',
          confidence: 0.8,
          processor: 'web-scraper',
          description: 'E-commerce URL requiring web scraping'
        };
      }

      // PDF links
      if (pathname.endsWith('.pdf')) {
        return {
          type: 'pdf_url',
          confidence: 0.9,
          processor: 'gpt5-vision',
          description: 'PDF URL requiring download and GPT-5 Vision analysis'
        };
      }

      // Image links
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
      if (imageExtensions.some(ext => pathname.endsWith(ext))) {
        return {
          type: 'image_url',
          confidence: 0.85,
          processor: 'gpt5-vision',
          description: 'Image URL requiring download and GPT-5 Vision analysis'
        };
      }

      return {
        type: 'web_url',
        confidence: 0.6,
        processor: 'web-scraper',
        description: 'Web URL requiring scraping'
      };
    } catch (error) {
      return {
        type: 'invalid_url',
        confidence: 0.1,
        processor: 'manual-review',
        description: 'Invalid URL format'
      };
    }
  }

  /**
   * Detect text content patterns
   */
  static detectTextContent(text) {
    if (!text || text.trim().length === 0) {
      return {
        type: 'empty_text',
        confidence: 0.95,
        processor: 'none',
        description: 'Empty or whitespace text'
      };
    }

    // Spanish order table patterns
    const spanishOrderPatterns = [
      /DESCRIPCION\s+COMPRA/i,
      /UNIDAD\/CANTIDAD/i,
      /TOTAL/i,
      /€/g,
      /Kilogramo/i,
      /Litro/i,
      /OBSERVACIONES/i
    ];

    const spanishMatches = spanishOrderPatterns.filter(pattern => pattern.test(text)).length;

    if (spanishMatches >= 3) {
      return {
        type: 'spanish_order_table',
        confidence: 0.9,
        processor: 'deepseek-r1',
        description: 'Spanish order table format detected - DeepSeek R1 processing'
      };
    }

    // General order patterns
    const orderPatterns = [
      /order/i,
      /pedido/i,
      /cantidad/i,
      /quantity/i,
      /precio/i,
      /price/i,
      /total/i,
      /€|$|\$/g
    ];

    const orderMatches = orderPatterns.filter(pattern => pattern.test(text)).length;

    if (orderMatches >= 2) {
      return {
        type: 'order_text',
        confidence: 0.7,
        processor: 'deepseek-r1',
        description: 'Order-related text content - DeepSeek R1 processing'
      };
    }

    // Check for URLs in text
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlPattern);
    if (urls && urls.length > 0) {
      return {
        type: 'text_with_urls',
        confidence: 0.8,
        processor: 'web-scraper',
        description: 'Text containing URLs for processing',
        urls: urls
      };
    }

    return {
      type: 'general_text',
      confidence: 0.5,
      processor: 'deepseek-r1',
      description: 'General text content - DeepSeek R1 processing'
    };
  }

  /**
   * Get processing priority based on content type
   */
  static getProcessingPriority(detection) {
    const priorityMap = {
      'spanish_order_table': 1,
      'pdf': 2,
      'order_text': 3,
      'ecommerce_url': 4,
      'pdf_url': 5,
      'image': 6,
      'document': 7,
      'web_url': 8,
      'general_text': 9,
      'unknown': 10
    };

    const primaryType = detection.primaryContent?.type || 'unknown';
    return priorityMap[primaryType] || 10;
  }

  /**
   * Validate if content is processable
   */
  static isProcessable(detection) {
    if (!detection.primaryContent) {
      return { processable: false, reason: 'No primary content detected' };
    }

    const unprocessableTypes = ['unknown', 'empty_text', 'invalid_url'];
    if (unprocessableTypes.includes(detection.primaryContent.type)) {
      return {
        processable: false,
        reason: `Content type '${detection.primaryContent.type}' is not processable`
      };
    }

    if (detection.primaryContent.confidence < 0.3) {
      return {
        processable: false,
        reason: 'Content detection confidence too low'
      };
    }

    return { processable: true, reason: 'Content is processable' };
  }
}

export default ContentDetector;