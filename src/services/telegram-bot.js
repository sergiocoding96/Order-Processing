import TelegramBot from 'node-telegram-bot-api';
import fsp from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';
import { ContentDetector } from './content-detector.js';
import { processingQueue } from './processing-queue.js';

const TEMP_DIR = path.resolve('temp');

async function ensureTempDir() {
    try {
        await fsp.mkdir(TEMP_DIR, { recursive: true });
    } catch (error) {
        logger.warn('Failed to create temp directory', { error: error.message });
    }
}

export function startTelegramBot(options = {}) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        logger.info('TELEGRAM_BOT_TOKEN not set. Telegram bot will not start.');
        return null;
    }

    const polling = options.polling ?? (process.env.TELEGRAM_POLLING !== 'false');
    const bot = new TelegramBot(token, { polling });
    logger.info('Telegram bot started', { polling });

    ensureTempDir();

    // Documents (PDFs, spreadsheets, etc.)
    bot.on('document', async (msg) => {
        try {
            const file = await bot.getFile(msg.document.file_id);
            const fileName = msg.document.file_name || `telegram_${Date.now()}`;
            const filePath = path.join(TEMP_DIR, fileName);

            const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
            const resp = await fetch(url);
            const buf = Buffer.from(await resp.arrayBuffer());
            await fsp.writeFile(filePath, buf);

            const webhookData = {
                source: 'telegram',
                messageId: msg.message_id,
                chatId: msg.chat.id,
                userId: msg.from?.id,
                username: msg.from?.username,
                document: {
                    fileId: msg.document.file_id,
                    fileName,
                    mimeType: msg.document.mime_type || msg.document.mimeType || 'application/octet-stream',
                    fileSize: msg.document.file_size || 0,
                    path: filePath
                }
            };

            const detection = ContentDetector.detect(webhookData);
            const processability = ContentDetector.isProcessable(detection);
            if (!processability.processable) {
                await bot.sendMessage(msg.chat.id, `Cannot process this document: ${processability.reason}`);
                return;
            }
            const queueId = await processingQueue.addToQueue(webhookData, detection);
            await bot.sendMessage(msg.chat.id, `Received ${fileName}. Processing... (ID: ${queueId})`);
        } catch (error) {
            logger.error('Telegram document handling failed', { error: error.message });
            await bot.sendMessage(msg.chat.id, 'Error processing document.');
        }
    });

    // Photos (images)
    bot.on('photo', async (msg) => {
        try {
            const photo = msg.photo[msg.photo.length - 1];
            const file = await bot.getFile(photo.file_id);
            const fileName = `telegram_photo_${Date.now()}.jpg`;
            const filePath = path.join(TEMP_DIR, fileName);

            const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
            const resp = await fetch(url);
            const buf = Buffer.from(await resp.arrayBuffer());
            await fsp.writeFile(filePath, buf);

            const webhookData = {
                source: 'telegram',
                messageId: msg.message_id,
                chatId: msg.chat.id,
                userId: msg.from?.id,
                username: msg.from?.username,
                photo: {
                    fileId: photo.file_id,
                    fileSize: photo.file_size || 0,
                    width: photo.width,
                    height: photo.height,
                    path: filePath
                }
            };

            const detection = ContentDetector.detect(webhookData);
            const processability = ContentDetector.isProcessable(detection);
            if (!processability.processable) {
                await bot.sendMessage(msg.chat.id, `Cannot process this image: ${processability.reason}`);
                return;
            }
            const queueId = await processingQueue.addToQueue(webhookData, detection);
            await bot.sendMessage(msg.chat.id, `Image received. Processing... (ID: ${queueId})`);
        } catch (error) {
            logger.error('Telegram photo handling failed', { error: error.message });
            await bot.sendMessage(msg.chat.id, 'Error processing image.');
        }
    });

    // Text (URLs or order-like text)
    bot.on('text', async (msg) => {
        const text = (msg.text || '').trim();
        if (text.startsWith('/')) {
            // Minimal help since explicit commands are not needed
            await bot.sendMessage(msg.chat.id, 'Send me PDFs, images, URLs or order text and I will process them.');
            return;
        }

        try {
            const urlMatch = text.match(/https?:\/\/[^\s]+/);
            const webhookData = {
                source: 'telegram',
                messageId: msg.message_id,
                chatId: msg.chat.id,
                userId: msg.from?.id,
                username: msg.from?.username,
                text,
                url: urlMatch ? urlMatch[0] : undefined
            };

            const detection = ContentDetector.detect(webhookData);
            const processability = ContentDetector.isProcessable(detection);
            if (!processability.processable) {
                await bot.sendMessage(msg.chat.id, `Cannot process this message: ${processability.reason}`);
                return;
            }
            const queueId = await processingQueue.addToQueue(webhookData, detection);
            await bot.sendMessage(msg.chat.id, `Message received. Processing... (ID: ${queueId})`);
        } catch (error) {
            logger.error('Telegram text handling failed', { error: error.message });
            await bot.sendMessage(msg.chat.id, 'Error processing message.');
        }
    });

    return bot;
}

export default startTelegramBot;

