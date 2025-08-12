import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import SecurityUtils from '../utils/security.js';
import { ContentDetector } from '../services/content-detector.js';
import { Validators } from '../utils/validators.js';
import { processingQueue } from '../services/processing-queue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// SECURITY FIX: Rate limiting for webhook endpoints
const mailhookRateLimit = SecurityUtils.createRateLimit(60000, 50); // 50 requests per minute
const telegramRateLimit = SecurityUtils.createRateLimit(60000, 100); // 100 requests per minute

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(path.dirname(__dirname), '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    // SECURITY FIX: Enhanced file validation with security checks
    try {
      const validatedFile = SecurityUtils.validateFileUpload(file);
      
      // Additional MIME type validation
      const allowedTypes = /pdf|jpeg|jpg|png|gif|txt|doc|docx|xls|xlsx/;
      const extname = allowedTypes.test(path.extname(validatedFile.originalname).toLowerCase());
      const mimetype = allowedTypes.test(validatedFile.mimetype);

      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('File type not allowed after security validation'));
      }
    } catch (error) {
      logger.error('File upload security validation failed', error);
      cb(new Error(`Security validation failed: ${error.message}`));
    }
  }
});

// Simple Mailhook Endpoint (like Make.com mailhook)
router.post('/webhook/mailhook', upload.array('attachments', 5), async (req, res) => {
  let uploadedFiles = [];
  
  try {
    // SECURITY FIX: Apply rate limiting
    const clientId = req.ip || 'unknown';
    mailhookRateLimit(clientId);
    logger.info('Mailhook received', {
      hasBody: !!req.body,
      fileCount: req.files?.length || 0,
      from: req.body.from || req.body.sender,
      subject: req.body.subject
    });

    // SECURITY FIX: Enhanced file validation with security checks
    uploadedFiles = req.files || [];
    if (uploadedFiles.length > 0) {
      // Apply security validation first
      try {
        uploadedFiles = uploadedFiles.map(file => SecurityUtils.validateFileUpload(file));
      } catch (securityError) {
        logger.error('File security validation failed', securityError);
        await Validators.cleanupFiles(uploadedFiles);
        return res.status(400).json({
          success: false,
          error: 'File security validation failed',
          message: securityError.message
        });
      }
      
      // Then apply standard validation
      const fileValidation = Validators.validateFiles(uploadedFiles);
      if (!fileValidation.valid) {
        logger.error('File validation failed', fileValidation.error);
        await Validators.cleanupFiles(uploadedFiles);
        return res.status(400).json({
          success: false,
          error: 'Invalid files',
          message: fileValidation.error
        });
      }
    }

    // SECURITY FIX: Sanitize email data and limit size
    const emailData = {
      timestamp: new Date().toISOString(),
      source: 'mailhook',
      messageId: SecurityUtils.sanitizeSQLParam(req.body.messageId || req.body.id || `email-${Date.now()}`),
      from: SecurityUtils.sanitizeSQLParam(req.body.from || req.body.sender || 'unknown@example.com'),
      to: SecurityUtils.sanitizeSQLParam(req.body.to || req.body.recipient || ''),
      subject: SecurityUtils.truncateString(req.body.subject || 'No Subject', 200),
      body: SecurityUtils.truncateString(req.body.body || req.body.text || req.body.content || '', 10000),
      attachments: uploadedFiles,
      metadata: {
        originalDataSize: JSON.stringify(req.body).length,
        receivedAt: new Date().toISOString()
      }
    };

    // Detect content type
    const detection = ContentDetector.detect(emailData);
    const processability = ContentDetector.isProcessable(detection);

    logger.info('Email content detection completed', {
      messageId: emailData.messageId,
      from: emailData.from,
      subject: emailData.subject,
      primaryContentType: detection.primaryContent?.type,
      processable: processability.processable,
      attachmentCount: uploadedFiles.length
    });

    // Add to processing queue if content is processable
    let queueId = null;
    if (processability.processable) {
      try {
        queueId = await processingQueue.addToQueue(emailData, detection);
        logger.info('Email queued for processing', {
          messageId: emailData.messageId,
          queueId: queueId
        });
      } catch (queueError) {
        logger.error('Failed to add email to processing queue', queueError);
      }
    }
    
    const response = {
      success: true,
      message: 'Email processed successfully',
      processedAt: emailData.timestamp,
      queueId: queueId,
      email: {
        messageId: emailData.messageId,
        from: emailData.from,
        subject: emailData.subject,
        attachmentCount: uploadedFiles.length
      },
      detection: {
        primaryContentType: detection.primaryContent?.type,
        processable: processability.processable,
        priority: ContentDetector.getProcessingPriority(detection)
      }
    };

    if (!processability.processable) {
      response.warning = processability.reason;
      logger.warn('Email content not processable', {
        messageId: emailData.messageId,
        reason: processability.reason
      });
    }

    res.status(200).json(response);

  } catch (error) {
    logger.error('Mailhook processing failed', error);
    
    // SECURITY FIX: Always cleanup uploaded files on error
    if (uploadedFiles && uploadedFiles.length > 0) {
      try {
        await Validators.cleanupFiles(uploadedFiles);
      } catch (cleanupError) {
        logger.error('Failed to cleanup files after error', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Email processing failed',
      message: SecurityUtils.truncateString(error.message, 200)
    });
  }
});

// Telegram Webhook Endpoint
router.post('/webhook/telegram', async (req, res) => {
  try {
    // SECURITY FIX: Apply rate limiting
    const clientId = req.ip || 'unknown';
    telegramRateLimit(clientId);
    const update = req.body;
    
    logger.info('Telegram webhook received', {
      updateId: update.update_id,
      messageType: update.message ? 'message' : update.callback_query ? 'callback' : 'unknown'
    });

    // Validate webhook data
    const validation = Validators.validateTelegramWebhook(update);
    if (!validation.valid) {
      logger.error('Telegram webhook validation failed', validation.error);
      return res.status(400).json({
        success: false,
        error: 'Invalid Telegram webhook data',
        message: validation.error
      });
    }

    // Process different types of updates
    let processedData = {
      timestamp: new Date().toISOString(),
      source: 'telegram',
      updateId: validation.data.update_id
    };

    if (validation.data.message) {
      const message = validation.data.message;
      processedData = {
        ...processedData,
        messageId: message.message_id,
        chatId: message.chat.id,
        userId: message.from.id,
        username: message.from.username || '',
        text: message.text || '',
        messageType: 'text'
      };

      // Handle different message types
      if (message.document) {
        processedData.messageType = 'document';
        processedData.document = {
          fileId: message.document.file_id,
          fileName: message.document.file_name || '',
          mimeType: message.document.mime_type || '',
          fileSize: message.document.file_size || 0
        };
      } else if (message.photo && message.photo.length > 0) {
        processedData.messageType = 'photo';
        processedData.photo = message.photo[message.photo.length - 1]; // Get highest resolution
      } else if (message.entities) {
        // Check for URLs
        const urlEntity = message.entities.find(entity => entity.type === 'url');
        if (urlEntity && message.text) {
          const url = message.text.substring(urlEntity.offset, urlEntity.offset + urlEntity.length);
          const urlValidation = Validators.validateUrl(url);
          if (urlValidation.valid) {
            processedData.url = urlValidation.url;
            processedData.messageType = 'url';
          }
        }
      }
    }

    // Detect content type
    const detection = ContentDetector.detect(processedData);
    const processability = ContentDetector.isProcessable(detection);

    logger.info('Telegram content detection completed', {
      updateId: processedData.updateId,
      primaryContentType: detection.primaryContent?.type,
      processable: processability.processable,
      chatId: processedData.chatId
    });

    // Add to processing queue if content is processable
    let queueId = null;
    if (processability.processable) {
      try {
        queueId = await processingQueue.addToQueue(processedData, detection);
        logger.info('Telegram webhook queued for processing', {
          updateId: processedData.updateId,
          queueId: queueId
        });
      } catch (queueError) {
        logger.error('Failed to add to processing queue', queueError);
      }
    }

    const response = {
      success: true,
      message: 'Webhook processed successfully',
      processedAt: processedData.timestamp,
      queueId: queueId,
      detection: {
        primaryContentType: detection.primaryContent?.type,
        processable: processability.processable,
        priority: ContentDetector.getProcessingPriority(detection)
      }
    };

    if (!processability.processable) {
      response.warning = processability.reason;
      logger.warn('Telegram content not processable', {
        updateId: processedData.updateId,
        reason: processability.reason
      });
    }

    res.status(200).json(response);

  } catch (error) {
    logger.error('Telegram webhook processing failed', error);
    res.status(500).json({
      success: false,
      error: 'Webhook processing failed',
      message: error.message
    });
  }
});

// Health check for webhooks
router.get('/webhook/health', (req, res) => {
  const queueStatus = processingQueue.getStatus();
  
  res.json({
    status: 'ok',
    webhooks: {
      mailhook: 'ready',
      telegram: 'ready'
    },
    endpoints: {
      mailhook: '/webhook/mailhook',
      telegram: '/webhook/telegram'
    },
    queue: queueStatus,
    timestamp: new Date().toISOString()
  });
});

// Queue status endpoint
router.get('/webhook/queue/status', (req, res) => {
  try {
    const status = processingQueue.getStatus();
    res.json({
      success: true,
      queue: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get queue status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get queue status'
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    logger.error('File upload error', error);
    return res.status(400).json({
      success: false,
      error: 'File upload error',
      message: error.message
    });
  }

  if (error.message === 'Only PDF, image, and document files are allowed!') {
    return res.status(400).json({
      success: false,
      error: 'Invalid file type',
      message: error.message
    });
  }

  next(error);
});

export default router;