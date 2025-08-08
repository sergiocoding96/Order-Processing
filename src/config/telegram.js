import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

// Create bot instance
export const bot = new TelegramBot(token, { 
  polling: false // We'll use webhooks instead
});

export const setupWebhook = async () => {
  if (!webhookUrl) {
    logger.warn('TELEGRAM_WEBHOOK_URL not set, webhook not configured');
    return false;
  }

  try {
    const webhookInfo = await bot.getWebHookInfo();
    
    if (webhookInfo.url === webhookUrl) {
      logger.info('Telegram webhook already configured', { url: webhookUrl });
      return true;
    }

    await bot.setWebHook(webhookUrl);
    logger.info('Telegram webhook configured successfully', { url: webhookUrl });
    return true;
  } catch (error) {
    logger.error('Failed to setup Telegram webhook', error);
    return false;
  }
};

export const removeWebhook = async () => {
  try {
    await bot.deleteWebHook();
    logger.info('Telegram webhook removed successfully');
    return true;
  } catch (error) {
    logger.error('Failed to remove Telegram webhook', error);
    return false;
  }
};

export const getBotInfo = async () => {
  try {
    const me = await bot.getMe();
    logger.info('Bot info retrieved', {
      id: me.id,
      username: me.username,
      firstName: me.first_name
    });
    return me;
  } catch (error) {
    logger.error('Failed to get bot info', error);
    throw error;
  }
};

export const sendMessage = async (chatId, message, options = {}) => {
  try {
    const result = await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...options
    });
    
    logger.info('Message sent successfully', {
      chatId,
      messageId: result.message_id
    });
    
    return result;
  } catch (error) {
    logger.error('Failed to send message', { chatId, error });
    throw error;
  }
};

export const sendDocument = async (chatId, document, options = {}) => {
  try {
    const result = await bot.sendDocument(chatId, document, options);
    
    logger.info('Document sent successfully', {
      chatId,
      messageId: result.message_id
    });
    
    return result;
  } catch (error) {
    logger.error('Failed to send document', { chatId, error });
    throw error;
  }
};

export const downloadFile = async (fileId) => {
  try {
    const fileInfo = await bot.getFile(fileId);
    const fileStream = bot.getFileStream(fileId);
    
    logger.info('File download initiated', {
      fileId,
      filePath: fileInfo.file_path,
      fileSize: fileInfo.file_size
    });
    
    return {
      info: fileInfo,
      stream: fileStream
    };
  } catch (error) {
    logger.error('Failed to download file', { fileId, error });
    throw error;
  }
};

// Bot command handlers will be defined in the services layer
export default {
  bot,
  setupWebhook,
  removeWebhook,
  getBotInfo,
  sendMessage,
  sendDocument,
  downloadFile
};