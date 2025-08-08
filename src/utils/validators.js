import Joi from 'joi';
import path from 'path';
import fs from 'fs';
import logger from './logger.js';

export class Validators {
  
  // File validation schema
  static fileSchema = Joi.object({
    fieldname: Joi.string().required(),
    originalname: Joi.string().required(),
    encoding: Joi.string().required(),
    mimetype: Joi.string().required(),
    size: Joi.number().max(10 * 1024 * 1024).required(), // 10MB max
    destination: Joi.string().required(),
    filename: Joi.string().required(),
    path: Joi.string().required()
  });

  // Outlook webhook validation schema
  static outlookWebhookSchema = Joi.object({
    subject: Joi.string().allow(''),
    from: Joi.string().email().allow(''),
    body: Joi.string().allow(''),
    bodyType: Joi.string().valid('text', 'html').allow(''),
    id: Joi.string().allow(''),
    conversationId: Joi.string().allow(''),
    receivedDateTime: Joi.string().isoDate().allow('')
  });

  // Telegram webhook validation schema
  static telegramWebhookSchema = Joi.object({
    update_id: Joi.number().required(),
    message: Joi.object({
      message_id: Joi.number().required(),
      from: Joi.object({
        id: Joi.number().required(),
        username: Joi.string().allow(''),
        first_name: Joi.string().allow(''),
        last_name: Joi.string().allow('')
      }).required(),
      chat: Joi.object({
        id: Joi.number().required(),
        type: Joi.string().valid('private', 'group', 'supergroup', 'channel')
      }).required(),
      date: Joi.number().required(),
      text: Joi.string().allow(''),
      document: Joi.object({
        file_id: Joi.string().required(),
        file_name: Joi.string().allow(''),
        mime_type: Joi.string().allow(''),
        file_size: Joi.number().allow(null)
      }),
      photo: Joi.array().items(Joi.object({
        file_id: Joi.string().required(),
        width: Joi.number().required(),
        height: Joi.number().required(),
        file_size: Joi.number().allow(null)
      })),
      entities: Joi.array().items(Joi.object({
        type: Joi.string().required(),
        offset: Joi.number().required(),
        length: Joi.number().required()
      }))
    }),
    callback_query: Joi.object({
      id: Joi.string().required(),
      from: Joi.object().required(),
      message: Joi.object(),
      data: Joi.string()
    })
  }).xor('message', 'callback_query');

  /**
   * Validate uploaded file
   */
  static validateFile(file) {
    try {
      const { error, value } = this.fileSchema.validate(file);
      
      if (error) {
        logger.error('File validation failed', { 
          filename: file.originalname, 
          error: error.message 
        });
        return { valid: false, error: error.message };
      }

      // Additional file type validation
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];

      if (!allowedTypes.includes(file.mimetype)) {
        return { 
          valid: false, 
          error: `File type ${file.mimetype} not allowed` 
        };
      }

      // Check file extension matches mime type
      const ext = path.extname(file.originalname).toLowerCase();
      const mimeTypeMap = {
        '.pdf': 'application/pdf',
        '.jpg': ['image/jpeg', 'image/jpg'],
        '.jpeg': ['image/jpeg', 'image/jpg'],
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.txt': 'text/plain',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };

      const expectedMimeType = mimeTypeMap[ext];
      if (expectedMimeType) {
        const isValidMimeType = Array.isArray(expectedMimeType) 
          ? expectedMimeType.includes(file.mimetype)
          : expectedMimeType === file.mimetype;
        
        if (!isValidMimeType) {
          return { 
            valid: false, 
            error: `File extension ${ext} doesn't match mime type ${file.mimetype}` 
          };
        }
      }

      // Check if file actually exists
      if (!fs.existsSync(file.path)) {
        return { 
          valid: false, 
          error: 'Uploaded file not found on disk' 
        };
      }

      logger.info('File validation successful', {
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      });

      return { valid: true, file: value };
    } catch (error) {
      logger.error('File validation error', error);
      return { valid: false, error: 'File validation failed' };
    }
  }

  /**
   * Validate multiple files
   */
  static validateFiles(files) {
    if (!files || !Array.isArray(files)) {
      return { valid: false, error: 'No files provided or invalid format' };
    }

    if (files.length === 0) {
      return { valid: true, files: [] };
    }

    if (files.length > 5) {
      return { valid: false, error: 'Maximum 5 files allowed' };
    }

    const validatedFiles = [];
    const errors = [];

    for (const file of files) {
      const validation = this.validateFile(file);
      if (validation.valid) {
        validatedFiles.push(validation.file);
      } else {
        errors.push(`${file.originalname}: ${validation.error}`);
      }
    }

    if (errors.length > 0) {
      return { valid: false, error: errors.join('; ') };
    }

    return { valid: true, files: validatedFiles };
  }

  /**
   * Validate Outlook webhook data
   */
  static validateOutlookWebhook(data) {
    try {
      const { error, value } = this.outlookWebhookSchema.validate(data, {
        allowUnknown: true,
        stripUnknown: true
      });

      if (error) {
        logger.error('Outlook webhook validation failed', error.details);
        return { valid: false, error: error.message };
      }

      return { valid: true, data: value };
    } catch (error) {
      logger.error('Outlook webhook validation error', error);
      return { valid: false, error: 'Webhook validation failed' };
    }
  }

  /**
   * Validate Telegram webhook data
   */
  static validateTelegramWebhook(data) {
    try {
      const { error, value } = this.telegramWebhookSchema.validate(data, {
        allowUnknown: true,
        stripUnknown: true
      });

      if (error) {
        logger.error('Telegram webhook validation failed', error.details);
        return { valid: false, error: error.message };
      }

      return { valid: true, data: value };
    } catch (error) {
      logger.error('Telegram webhook validation error', error);
      return { valid: false, error: 'Webhook validation failed' };
    }
  }

  /**
   * Sanitize filename for safe storage
   */
  static sanitizeFilename(filename) {
    if (!filename) return 'unknown';
    
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .substring(0, 100); // Limit length
  }

  /**
   * Validate URL format
   */
  static validateUrl(url) {
    try {
      const urlObj = new URL(url);
      
      // Only allow HTTP/HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { valid: false, error: 'Only HTTP/HTTPS URLs are allowed' };
      }

      // Block localhost and private IPs in production
      if (process.env.NODE_ENV === 'production') {
        const hostname = urlObj.hostname.toLowerCase();
        const privateRanges = [
          'localhost',
          '127.0.0.1',
          '0.0.0.0',
          '10.',
          '172.16.',
          '172.17.',
          '172.18.',
          '172.19.',
          '172.2',
          '172.3',
          '192.168.'
        ];

        if (privateRanges.some(range => hostname.startsWith(range))) {
          return { valid: false, error: 'Private/local URLs not allowed' };
        }
      }

      return { valid: true, url: urlObj.href };
    } catch (error) {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  /**
   * Validate content size limits
   */
  static validateContentSize(content, maxSize = 1024 * 1024) { // 1MB default
    if (!content) {
      return { valid: true, size: 0 };
    }

    const size = typeof content === 'string' 
      ? Buffer.byteLength(content, 'utf8')
      : content.length;

    if (size > maxSize) {
      return { 
        valid: false, 
        error: `Content size ${size} bytes exceeds maximum ${maxSize} bytes` 
      };
    }

    return { valid: true, size };
  }

  /**
   * Clean temporary files
   */
  static async cleanupFiles(files) {
    if (!files || !Array.isArray(files)) return;

    const cleanupPromises = files.map(async (file) => {
      try {
        if (file.path && fs.existsSync(file.path)) {
          await fs.promises.unlink(file.path);
          logger.info('Temporary file cleaned up', { path: file.path });
        }
      } catch (error) {
        logger.error('Failed to cleanup file', { path: file.path, error });
      }
    });

    await Promise.all(cleanupPromises);
  }
}

export default Validators;