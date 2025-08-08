import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MailhookProcessor {
  
  /**
   * Process mailhook data from various providers
   */
  static processMailhook(body, files = []) {
    // Detect mailhook provider and format
    const provider = this.detectProvider(body);
    
    logger.info('Processing mailhook', {
      provider: provider.name,
      confidence: provider.confidence,
      attachmentCount: files.length
    });

    switch (provider.name) {
      case 'mailgun':
        return this.processMailgun(body, files);
      case 'sendgrid':
        return this.processSendGrid(body, files);
      case 'postmark':
        return this.processPostmark(body, files);
      case 'generic':
        return this.processGeneric(body, files);
      default:
        return this.processGeneric(body, files);
    }
  }

  /**
   * Detect mailhook provider based on request structure
   */
  static detectProvider(body) {
    // Mailgun indicators
    if (body['Message-Id'] && body['sender'] && body['recipient']) {
      return { name: 'mailgun', confidence: 0.9 };
    }

    // SendGrid indicators
    if (body.envelope && body.from && body.to) {
      return { name: 'sendgrid', confidence: 0.9 };
    }

    // Postmark indicators
    if (body.MessageID && body.From && body.To) {
      return { name: 'postmark', confidence: 0.9 };
    }

    // Generic email webhook
    if (body.subject || body.from || body.to) {
      return { name: 'generic', confidence: 0.6 };
    }

    return { name: 'unknown', confidence: 0.1 };
  }

  /**
   * Process Mailgun webhook
   */
  static processMailgun(body, files) {
    const emailData = {
      messageId: body['Message-Id'],
      from: body['sender'],
      to: body['recipient'],
      subject: body['subject'] || '',
      textBody: body['body-plain'] || '',
      htmlBody: body['body-html'] || '',
      timestamp: body['timestamp'] ? new Date(parseInt(body['timestamp']) * 1000).toISOString() : new Date().toISOString(),
      attachments: files,
      provider: 'mailgun',
      metadata: {
        signature: body['signature'],
        token: body['token'],
        domain: body['domain']
      }
    };

    return this.normalizeEmailData(emailData);
  }

  /**
   * Process SendGrid webhook
   */
  static processSendGrid(body, files) {
    const emailData = {
      messageId: body.envelope?.messageId || body.messageId,
      from: body.from?.email || body.from,
      to: body.to?.email || body.to,
      subject: body.subject || '',
      textBody: body.text || '',
      htmlBody: body.html || '',
      timestamp: body.timestamp || new Date().toISOString(),
      attachments: files,
      provider: 'sendgrid',
      metadata: {
        envelope: body.envelope,
        headers: body.headers
      }
    };

    return this.normalizeEmailData(emailData);
  }

  /**
   * Process Postmark webhook
   */
  static processPostmark(body, files) {
    const emailData = {
      messageId: body.MessageID,
      from: body.From,
      to: body.To,
      subject: body.Subject || '',
      textBody: body.TextBody || '',
      htmlBody: body.HtmlBody || '',
      timestamp: body.Date || new Date().toISOString(),
      attachments: files,
      provider: 'postmark',
      metadata: {
        mailboxHash: body.MailboxHash,
        tag: body.Tag
      }
    };

    return this.normalizeEmailData(emailData);
  }

  /**
   * Process generic email webhook
   */
  static processGeneric(body, files) {
    const emailData = {
      messageId: body.messageId || body.id || `generic-${Date.now()}`,
      from: body.from || body.sender || body.From,
      to: body.to || body.recipient || body.To,
      subject: body.subject || body.Subject || '',
      textBody: body.text || body['text-body'] || body.body || body.TextBody || '',
      htmlBody: body.html || body['html-body'] || body.HtmlBody || '',
      timestamp: body.timestamp || body.date || body.Date || new Date().toISOString(),
      attachments: files,
      provider: 'generic',
      metadata: body
    };

    return this.normalizeEmailData(emailData);
  }

  /**
   * Normalize email data to standard format
   */
  static normalizeEmailData(emailData) {
    // Extract primary content (prefer text over HTML for order processing)
    let primaryContent = emailData.textBody;
    
    if (!primaryContent && emailData.htmlBody) {
      // Convert HTML to text (basic)
      primaryContent = this.htmlToText(emailData.htmlBody);
    }

    // Clean up content
    primaryContent = this.cleanEmailContent(primaryContent);

    const normalized = {
      timestamp: new Date().toISOString(),
      source: 'mailhook',
      provider: emailData.provider,
      messageId: emailData.messageId,
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      body: primaryContent,
      bodyType: emailData.textBody ? 'text' : 'html',
      attachments: emailData.attachments || [],
      metadata: {
        originalMessageId: emailData.messageId,
        provider: emailData.provider,
        receivedAt: emailData.timestamp,
        ...emailData.metadata
      }
    };

    logger.info('Email normalized', {
      provider: normalized.provider,
      from: normalized.from,
      subject: normalized.subject,
      bodyLength: normalized.body.length,
      attachmentCount: normalized.attachments.length
    });

    return normalized;
  }

  /**
   * Convert HTML to text (basic implementation)
   */
  static htmlToText(html) {
    if (!html) return '';
    
    return html
      // Remove script and style elements
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Replace common HTML elements with text equivalents
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/td>/gi, '\t')
      .replace(/<\/th>/gi, '\t')
      // Remove all other HTML tags
      .replace(/<[^>]*>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Clean up whitespace
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  /**
   * Clean email content for better processing
   */
  static cleanEmailContent(content) {
    if (!content) return '';

    return content
      // Remove email signatures (basic patterns)
      .replace(/--\s*\n[\s\S]*$/m, '')
      .replace(/^\s*Sent from.*$/gm, '')
      .replace(/^\s*Get Outlook for.*$/gm, '')
      // Remove quoted text (replies)
      .replace(/^\s*>.*$/gm, '')
      .replace(/^On .* wrote:[\s\S]*$/m, '')
      // Remove excessive whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  /**
   * Extract order-relevant content from email
   */
  static extractOrderContent(emailData) {
    const content = emailData.body;
    
    // Look for order patterns in the email
    const orderPatterns = [
      // Spanish order tables
      /DESCRIPCION\s+COMPRA.*?€/gs,
      // Product lists with prices
      /^.*?\d+.*?€.*$/gm,
      // Order totals
      /TOTAL.*?€/gi
    ];

    const extractedSections = [];
    
    for (const pattern of orderPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        extractedSections.push(...matches);
      }
    }

    return {
      hasOrderContent: extractedSections.length > 0,
      orderSections: extractedSections,
      fullContent: content
    };
  }

  /**
   * Validate mailhook request
   */
  static validateMailhookRequest(body, headers = {}) {
    const validation = {
      valid: false,
      provider: 'unknown',
      errors: []
    };

    // Basic validation - must have some email fields
    const requiredFields = ['from', 'subject'];
    const alternativeFields = {
      'from': ['sender', 'From', 'envelope.from'],
      'subject': ['Subject']
    };

    for (const field of requiredFields) {
      const hasField = body[field] || 
                     alternativeFields[field]?.some(alt => {
                       return alt.includes('.') ? 
                         alt.split('.').reduce((obj, key) => obj?.[key], body) : 
                         body[alt];
                     });
      
      if (!hasField) {
        validation.errors.push(`Missing required field: ${field}`);
      }
    }

    // Provider-specific validation
    const provider = this.detectProvider(body);
    validation.provider = provider.name;

    if (provider.name === 'mailgun') {
      // Mailgun signature validation would go here
      // if (body.token && body.timestamp && body.signature) {
      //   validation.signatureValid = this.validateMailgunSignature(body);
      // }
    }

    validation.valid = validation.errors.length === 0;
    return validation;
  }

  /**
   * Process attachments for order content
   */
  static async processAttachments(attachments) {
    const processedAttachments = [];

    for (const attachment of attachments) {
      try {
        const attachmentInfo = {
          originalName: attachment.originalname,
          filename: attachment.filename,
          path: attachment.path,
          size: attachment.size,
          mimeType: attachment.mimetype,
          processed: false,
          contentType: this.classifyAttachment(attachment)
        };

        // Add processing metadata
        if (attachmentInfo.contentType.processable) {
          attachmentInfo.processed = true;
          attachmentInfo.processingMethod = attachmentInfo.contentType.method;
        }

        processedAttachments.push(attachmentInfo);

        logger.info('Attachment processed', {
          filename: attachment.originalname,
          type: attachmentInfo.contentType.type,
          processable: attachmentInfo.contentType.processable
        });

      } catch (error) {
        logger.error('Attachment processing failed', {
          filename: attachment.originalname,
          error: error.message
        });
      }
    }

    return processedAttachments;
  }

  /**
   * Classify attachment type and processing method
   */
  static classifyAttachment(attachment) {
    const extension = path.extname(attachment.originalname).toLowerCase();
    const mimeType = attachment.mimetype;

    if (extension === '.pdf' || mimeType === 'application/pdf') {
      return {
        type: 'pdf',
        processable: true,
        method: 'gpt4-vision',
        description: 'PDF document requiring visual analysis'
      };
    }

    const imageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    if (imageTypes.includes(extension) || mimeType.startsWith('image/')) {
      return {
        type: 'image',
        processable: true,
        method: 'gpt4-vision',
        description: 'Image requiring visual analysis'
      };
    }

    const docTypes = ['.doc', '.docx', '.txt'];
    if (docTypes.includes(extension) || mimeType.includes('document')) {
      return {
        type: 'document',
        processable: true,
        method: 'text-extraction',
        description: 'Document requiring text extraction'
      };
    }

    return {
      type: 'unknown',
      processable: false,
      method: 'manual-review',
      description: 'Unknown file type'
    };
  }
}

export default MailhookProcessor;