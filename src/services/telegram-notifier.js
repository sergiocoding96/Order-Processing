import logger from '../utils/logger.js';

let botInstance = null;

export function setTelegramBot(bot) {
    botInstance = bot;
}

export async function sendTelegramMessage(chatId, text) {
    try {
        if (!botInstance) return false;
        await botInstance.sendMessage(chatId, text);
        return true;
    } catch (error) {
        logger.warn('sendTelegramMessage failed', { error: error.message });
        return false;
    }
}

export async function sendTelegramDocument(chatId, filePath, options = {}) {
    try {
        if (!botInstance) return false;
        const { filename, caption, contentType } = options;
        await botInstance.sendDocument(chatId, filePath, { caption }, { filename, contentType });
        return true;
    } catch (error) {
        logger.warn('sendTelegramDocument failed', { error: error.message });
        return false;
    }
}

export default { setTelegramBot, sendTelegramMessage, sendTelegramDocument };

