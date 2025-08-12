import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

/**
 * AI MODEL ARCHITECTURE FOR ORDER PROCESSING SYSTEM
 * ================================================
 * 
 * OPTIMIZED 3-STEP PIPELINE:
 * 1. PDF → Image conversion (pdf2pic)
 * 2. GPT-4 Vision: Extract raw text from invoice images
 * 3. Gemini 2.0 Flash → GPT-4o-mini: Convert text to structured JSON
 * 
 * MODEL ASSIGNMENTS:
 * - GPT-4 Vision (gpt-4o): Visual analysis of invoice images (Step 2)
 * - Gemini 2.0 Flash: Primary JSON extraction (Step 3, ~1.9s, $0.075/1K tokens)  
 * - GPT-4o-mini: Fallback JSON extraction (Step 3, ~5s, 4x cheaper than DeepSeek)
 * 
 * PERFORMANCE TARGETS:
 * - Total processing: ~37 seconds (vs 60s+ with old DeepSeek)
 * - Success rate: 57%+ (4/7 invoices, improving with better prompts)
 */

// OpenAI client for GPT-4 Vision and GPT-4o-mini text processing
const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
  logger.warn('OPENAI_API_KEY not set - GPT-4 Vision and GPT-4o-mini will not be available');
}

export const openai = openaiApiKey ? new OpenAI({
  apiKey: openaiApiKey
}) : null;



// Google Gemini 2.0 Flash for fast reasoning
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  logger.warn('GEMINI_API_KEY not set - Gemini 2.0 Flash will not be available');
}

export const gemini = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

// AI provider availability check
export const checkAIProviders = () => {
  const providers = {
    openai: !!openai,
    gemini: !!gemini
  };

  logger.info('AI providers availability', providers);
  return providers;
};

// Vision model for visual analysis (PDFs, images)
export const analyzeVisualContent = async (imageData, prompt, options = {}) => {
  if (!openai) {
    throw new Error('OpenAI client not configured - OPENAI_API_KEY missing');
  }

  try {
    const preferredModel = options.model || 'gpt-4o';

    // Try GPT-5 via Responses API first
    if ((preferredModel || '').toLowerCase().startsWith('gpt-5')) {
      try {
        const response = await openai.responses.create({
          model: preferredModel,
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: prompt },
                {
                  type: 'input_image',
                  image_url: imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}`,
                  detail: options.detail || 'high'
                }
              ]
            }
          ],
          // Some GPT-5 models do not accept temperature; omit it
          max_output_tokens: options.maxCompletionTokens || options.maxTokens || 4000
        });

        const content = response.output_text || response.output?.[0]?.content?.[0]?.text || '';

        logger.info('Vision analysis completed', {
          model: preferredModel,
          usage: response.usage
        });

        return {
          success: true,
          content,
          usage: response.usage,
          model: preferredModel
        };
      } catch (err) {
        // Fall through to GPT-4o if model not found or unsupported params
        const msg = err?.message || '';
        logger.warn('GPT-5 vision call failed, falling back to gpt-4o', { error: msg });
      }
    }

    // Fallback to Chat Completions API with gpt-4o
    const model = 'gpt-4o';
    const request = {
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}`,
                detail: options.detail || 'high'
              }
            }
          ]
        }
      ],
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens || 4000
    };

    const response = await openai.chat.completions.create(request);

    logger.info('Vision analysis completed', {
      model: response.model,
      usage: response.usage
    });

    return {
      success: true,
      content: response.choices[0].message.content,
      usage: response.usage,
      model: response.model
    };
  } catch (error) {
    logger.error('Vision analysis failed', error);
    throw error;
  }
};



// GPT-4o-mini for fast, reliable text processing with structured outputs
export const processWithOpenAI = async (prompt, options = {}) => {
  if (!openai) {
    throw new Error('OpenAI client not configured - OPENAI_API_KEY missing');
  }

  try {
    const response = await openai.chat.completions.create({
      model: options.model || 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: options.maxTokens || 4000,
      temperature: options.temperature || 0.1,
      response_format: options.responseFormat || { type: 'text' }
    });

    logger.info('GPT-4o-mini processing completed', {
      model: response.model,
      usage: response.usage
    });

    return {
      success: true,
      content: response.choices[0].message.content,
      usage: response.usage,
      model: response.model,
      provider: 'openai-mini'
    };
  } catch (error) {
    logger.error('GPT-4o-mini processing failed', error);
    throw error;
  }
};

// Gemini 2.0 Flash for fast reasoning
export const processWithGemini = async (prompt, options = {}) => {
  if (!gemini) {
    throw new Error('Gemini client not configured - GEMINI_API_KEY missing');
  }

  try {
    const model = gemini.getGenerativeModel({
      model: options.model || 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: options.temperature || 0.1,
        maxOutputTokens: options.maxTokens || 4000,
        responseMimeType: options.responseFormat?.type === 'json_object' ? 'application/json' : 'text/plain'
      }
    });

    logger.info('Starting Gemini 2.0 Flash processing');

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    logger.info('Gemini 2.0 Flash processing completed', {
      model: 'gemini-2.0-flash-exp',
      candidateCount: response.candidates?.length || 1
    });

    return {
      success: true,
      content: content,
      provider: 'gemini',
      model: 'gemini-2.0-flash-exp'
    };
  } catch (error) {
    logger.error('Gemini 2.0 Flash processing failed', error);
    throw error;
  }
};

// Optimized text processing with smart fallback: Gemini 2.0 Flash → GPT-4o-mini (faster, more reliable)
export const processTextWithFallback = async (prompt, options = {}) => {
  const errors = [];

  // Try Gemini 2.0 Flash with retry logic
  if (gemini) {
    const maxRetries = options.maxRetries || 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Attempting text processing with Gemini 2.0 Flash (attempt ${attempt}/${maxRetries})`);
        const result = await processWithGemini(prompt, options);
        result.provider = 'gemini';

        // Validate JSON response if JSON format is requested
        if (options.responseFormat?.type === 'json_object') {
          try {
            const testParse = JSON.parse(result.content);
            if (!testParse || typeof testParse !== 'object') {
              throw new Error('Invalid JSON structure');
            }
            logger.info('Gemini JSON validation passed');
          } catch (jsonError) {
            if (attempt === maxRetries) {
              logger.warn('Gemini JSON validation failed on final attempt, falling back to GPT-4o-mini');
              errors.push({ provider: 'gemini', error: `JSON validation failed after ${maxRetries} attempts: ${jsonError.message}` });
              break; // Exit retry loop, go to GPT-4o-mini
            } else {
              logger.warn(`Gemini JSON invalid on attempt ${attempt}, retrying...`);
              continue; // Retry Gemini
            }
          }
        }

        return result; // Success!

      } catch (error) {
        logger.warn(`Gemini 2.0 Flash attempt ${attempt} failed: ${error.message}`);
        errors.push({ provider: 'gemini', attempt, error: error.message });

        // For API errors, don't retry - go straight to fallback
        if (error.message.includes('API') || error.message.includes('rate limit') || error.message.includes('quota')) {
          logger.warn('Gemini API error detected, skipping retries and using fallback');
          break;
        }

        // For last attempt, continue to fallback
        if (attempt === maxRetries) {
          logger.warn('Gemini max retries reached, falling back to GPT-4o-mini');
        }
      }
    }
  }

  // Fallback to GPT-4o-mini (fast, reliable, structured outputs)
  if (openai) {
    try {
      logger.info('Using GPT-4o-mini fallback (fast and reliable with structured outputs)');
      const result = await processWithOpenAI(prompt, {
        ...options,
        model: 'gpt-4o-mini',
        responseFormat: options.responseFormat || { type: 'json_object' }
      });
      result.provider = 'openai-mini';
      return result;
    } catch (error) {
      logger.error('GPT-4o-mini fallback also failed', error.message);
      errors.push({ provider: 'openai-mini', error: error.message });
    }
  }

  // If all fail, throw error with details
  throw new Error(`All text processing providers failed. Gemini attempts: ${errors.filter(e => e.provider === 'gemini').length}, GPT-4o-mini: ${errors.filter(e => e.provider === 'openai-mini').length > 0 ? 'failed' : 'not attempted'}`);
};

// Generate conversational response using GPT-4o-mini
export const generateChatResponse = async (message, context = {}, options = {}) => {
  const conversationalPrompt = `You are a helpful assistant for an order processing system. 
Context: ${JSON.stringify(context)}

User message: ${message}

Please provide a helpful and concise response in Spanish. If the user is asking about orders, use the provided context to give accurate information.`;

  try {
    const result = await processWithOpenAI(conversationalPrompt, {
      ...options,
      model: 'gpt-4o-mini',
      temperature: options.temperature || 0.3
    });

    return {
      success: true,
      response: result.content,
      provider: 'openai-mini',
      usage: result.usage
    };
  } catch (error) {
    logger.error('Chat response generation failed', error);
    throw error;
  }
};

export default {
  openai,
  gemini,
  checkAIProviders,
  analyzeVisualContent,
  processWithGemini,
  processWithOpenAI,
  processTextWithFallback,
  generateChatResponse
};