import { analyzeVisualContent, processTextWithFallback, generateChatResponse } from '../config/ai.js';
import { DocumentClassifier } from '../ai/classifier.js';
import XLSExporter from '../export/xlsExporter.js';
import { PDFProcessor } from './pdf-processor.js';
import { WebScraper } from './web-scraper.js';
import logger from '../utils/logger.js';
import SecurityUtils from '../utils/security.js';
import fs from 'fs';
import path from 'path';

export class AIProcessor {

  /**
   * Process content based on detection results
   */
  static async processContent(detection, contentData) {
    try {
      const processor = detection.primaryContent?.processor;

      logger.info('Starting AI processing', {
        primaryContentType: detection.primaryContent?.type,
        processor: processor,
        hasProcessor: !!processor,
        primaryContent: detection.primaryContent
      });

      switch (processor) {
        case 'gpt5-vision':
          return await this.processVisualContent(detection, contentData);

        case 'deepseek-r1':
          return await this.processTextContent(detection, contentData);

        case 'web-scraper':
          return await this.processWebContent(detection, contentData);

        default:
          throw new Error(`Unknown processor: ${processor}`);
      }
    } catch (error) {
      logger.error('AI processing failed', error);
      throw error;
    }
  }

  /**
   * Process visual content (PDFs, images) using GPT-5 Vision
   */
  static async processVisualContent(detection, contentData) {
    try {
      logger.info('Processing visual content', {
        contentType: detection.primaryContent?.type,
        hasFilePath: !!contentData.filePath,
        filePath: contentData.filePath,
        hasUrl: !!contentData.url,
        hasBase64: !!contentData.base64,
        filename: contentData.filename
      });

      let imageData;
      let processingNote = '';

      // Handle PDF files with streamlined processing
      if (detection.primaryContent?.type === 'pdf' && contentData.filePath) {
        logger.info('Processing PDF with streamlined pipeline');
        const pdfResult = await PDFProcessor.processPDF(contentData.filePath);

        if (!pdfResult.success) {
          throw new Error(`PDF processing failed: ${pdfResult.error}`);
        }

        // SECURITY FIX: Validate extracted data structure
        const validatedData = SecurityUtils.validateObjectStructure(pdfResult.extractedData || {});
        
        return {
          success: true,
          extractedData: validatedData,
          processingMethod: 'streamlined_pdf',
          confidence: pdfResult.confidence,
          rawResponse: SecurityUtils.truncateString(JSON.stringify(pdfResult.processingSteps), 2000),
          usage: pdfResult.usage || {}
        };
      }

      // SECURITY FIX: Safe buffer handling with memory limits
      if (contentData.filePath) {
        // Local file with size check
        const stats = fs.statSync(contentData.filePath);
        if (stats.size > 10 * 1024 * 1024) { // 10MB limit
          throw new Error(`File too large: ${stats.size} bytes`);
        }
        const fileBuffer = fs.readFileSync(contentData.filePath);
        const safeBuffer = SecurityUtils.processBufferSafely(fileBuffer);
        imageData = safeBuffer.toString('base64');
      } else if (contentData.url) {
        // Download with timeout and size limits
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        try {
          const response = await fetch(contentData.url, { 
            signal: controller.signal,
            headers: { 'User-Agent': 'OrderProcessor/1.0' }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const contentLength = response.headers.get('content-length');
          if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
            throw new Error('Remote file too large');
          }
          
          const buffer = await response.arrayBuffer();
          const safeBuffer = SecurityUtils.processBufferSafely(Buffer.from(buffer));
          imageData = safeBuffer.toString('base64');
        } finally {
          clearTimeout(timeoutId);
        }
      } else if (contentData.base64) {
        // Validate base64 and size
        if (contentData.base64.length > 15 * 1024 * 1024) { // ~10MB base64
          throw new Error('Base64 data too large');
        }
        imageData = contentData.base64;
      } else {
        throw new Error('No valid image data provided');
      }

      const orderExtractionPrompt = `Analyze this image/document and extract order information. 

Please identify and extract the following information in JSON format:
{
  "numero_pedido": "order number if visible",
  "cliente": "customer name if visible",
  "fecha_pedido": "order date in YYYY-MM-DD format if visible",
  "productos": [
    {
      "nombre_producto": "product name",
      "cantidad": number,
      "unidad": "unit (Kilogramo, Litro, etc.)",
      "precio_unitario": number,
      "total_producto": number
    }
  ],
  "total_pedido": number,
  "observaciones": "any additional notes or observations"
}

Focus on extracting product information with quantities, units, and prices. Look for Spanish product names and European currency (€). If some information is not visible or unclear, use null for that field.

The image may contain:
- A Spanish order table with products, quantities, and prices
- PDF invoice or order document
- Screenshot of an order
- Handwritten order information

Extract all visible product information accurately.`;

      const result = await analyzeVisualContent(imageData, orderExtractionPrompt, {
        model: 'gpt-4o',
        maxTokens: 4000,
        temperature: 0.1
      });

      // SECURITY FIX: Safe JSON parsing with injection protection
      let extractedData;
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = SecurityUtils.safeJSONParse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        logger.warn('Failed to parse JSON from GPT-4 Vision response', parseError);
        // Fallback: extract structured data from text response
        extractedData = this.extractDataFromText(SecurityUtils.truncateString(result.content, 10000));
      }

      const classification = DocumentClassifier.classify(result.content);

      const response = {
        success: true,
        extractedData,
        processingMethod: 'gpt5-vision',
        confidence: this.calculateConfidence(extractedData),
        rawResponse: result.content,
        usage: result.usage,
        classification: classification.type
      };

      // Optionally generate XLS
      if (contentData?.generateXLS || process.env.AUTO_EXPORT_XLS === 'true') {
        extractedData.tipo = classification.type;
        await XLSExporter.generateFromStructuredData(extractedData, 'Test Files Leo Output');
      }

      return response;

    } catch (error) {
      logger.error('Visual content processing failed', error);
      throw error;
    }
  }

  /**
   * Process text content using DeepSeek R1 with Claude fallback
   */
  static async processTextContent(detection, contentData) {
    try {
      const textContent = contentData.text || contentData.content || '';

      const orderExtractionPrompt = `Extract order information from this Spanish text and return ONLY a valid JSON object:

Text to analyze:
${textContent}

Return JSON in this exact format:
{
  "numero_pedido": "order number if mentioned",
  "cliente": "customer name if mentioned",
  "fecha_pedido": "order date in YYYY-MM-DD format if mentioned",
  "productos": [
    {
      "nombre_producto": "product name",
      "cantidad": number,
      "unidad": "unit (Kilogramo, Litro, etc.)",
      "precio_unitario": number,
      "total_producto": number
    }
  ],
  "total_pedido": number,
  "observaciones": "any additional notes"
}

Rules:
- Extract all products with their quantities and prices
- Convert all prices to numbers (remove € symbol)
- Use null for missing information
- Maintain Spanish product names
- Calculate totals if not explicitly stated
- Return ONLY the JSON object, no other text`;

      const result = await processTextWithFallback(orderExtractionPrompt, {
        maxTokens: 4000,
        temperature: 0.1,
        responseFormat: { type: 'json_object' }
      });

      // SECURITY FIX: Safe JSON parsing for AI responses
      let extractedData;
      try {
        // DeepSeek R1 may include reasoning, try to extract JSON
        let jsonContent = SecurityUtils.truncateString(result.content, 50000);

        // If it's DeepSeek R1, look for JSON in the response
        if (result.provider === 'deepseek') {
          const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonContent = jsonMatch[0];
          }
        }

        extractedData = SecurityUtils.safeJSONParse(jsonContent);
      } catch (parseError) {
        logger.warn('Failed to parse JSON response, attempting text extraction', {
          provider: result.provider,
          error: parseError.message,
          responsePreview: result.content.substring(0, 200)
        });
        extractedData = this.extractDataFromText(SecurityUtils.truncateString(result.content, 10000));
      }

      return {
        success: true,
        extractedData,
        processingMethod: result.provider,
        confidence: this.calculateConfidence(extractedData),
        rawResponse: result.content,
        usage: result.usage
      };

    } catch (error) {
      logger.error('Text content processing failed', error);
      throw error;
    }
  }

  /**
   * Process web content using web scraping
   */
  static async processWebContent(detection, contentData) {
    try {
      const url = contentData.url;

      if (!url) {
        throw new Error('No URL provided for web scraping');
      }

      // Validate URL
      const urlValidation = WebScraper.validateURL(url);
      if (!urlValidation.valid) {
        throw new Error(`Invalid URL: ${urlValidation.error}`);
      }

      // Scrape the URL
      const scrapedResult = await WebScraper.scrapeURL(url, {
        timeout: 30000
      });

      if (!scrapedResult.success) {
        throw new Error(`Web scraping failed: ${scrapedResult.error}`);
      }

      // Process scraped content with AI
      const processedResult = await WebScraper.processScrapedContent(scrapedResult);

      return {
        success: true,
        extractedData: processedResult.extractedData,
        processingMethod: 'web-scraping',
        confidence: this.calculateConfidence(processedResult.extractedData),
        scrapingMethod: scrapedResult.method,
        rawResponse: processedResult.rawResponse || scrapedResult.textContent
      };

    } catch (error) {
      logger.error('Web content processing failed', error);
      throw error;
    }
  }

  /**
   * Generate conversational response for Telegram bot
   */
  static async generateBotResponse(message, context = {}) {
    try {
      return await generateChatResponse(message, context, {
        maxTokens: 1000,
        temperature: 0.3
      });
    } catch (error) {
      logger.error('Bot response generation failed', error);
      throw error;
    }
  }

  /**
   * Extract structured data from text when JSON parsing fails
   */
  static extractDataFromText(textResponse) {
    const extractedData = {
      numero_pedido: null,
      cliente: null,
      fecha_pedido: null,
      productos: [],
      total_pedido: null,
      observaciones: textResponse
    };

    // Try to extract products using regex patterns
    const productPatterns = [
      // Spanish format: PRODUCT_NAME Kilogramo 10 27,98 €
      /([A-ZÁÉÍÓÚÑ\s]+)\s+(Kilogramo|Litro|Unidad|Pieza)\s+(\d+(?:,\d+)?)\s+(\d+,\d+)\s*€/gi,
      // Alternative format: PRODUCT_NAME 10 Kilogramo 27,98 €
      /([A-ZÁÉÍÓÚÑ\s]+)\s+(\d+(?:,\d+)?)\s+(Kilogramo|Litro|Unidad|Pieza)\s+(\d+,\d+)\s*€/gi
    ];

    for (const pattern of productPatterns) {
      let match;
      while ((match = pattern.exec(textResponse)) !== null) {
        const [, nombre, unidad, cantidad, precio] = match;
        extractedData.productos.push({
          nombre_producto: nombre.trim(),
          cantidad: parseFloat(cantidad.replace(',', '.')),
          unidad: unidad,
          precio_unitario: parseFloat(precio.replace(',', '.')),
          total_producto: parseFloat(cantidad.replace(',', '.')) * parseFloat(precio.replace(',', '.'))
        });
      }
    }

    // Calculate total if not found
    if (extractedData.productos.length > 0) {
      extractedData.total_pedido = extractedData.productos.reduce(
        (sum, product) => sum + (product.total_producto || 0), 0
      );
    }

    return extractedData;
  }

  /**
   * Calculate confidence score for extracted data
   */
  static calculateConfidence(extractedData) {
    let score = 0;

    // Check if we have products
    if (extractedData.productos && extractedData.productos.length > 0) {
      score += 0.4;

      // Check product completeness
      const completeProducts = extractedData.productos.filter(p =>
        p.nombre_producto && p.cantidad && p.precio_unitario
      );
      score += (completeProducts.length / extractedData.productos.length) * 0.4;
    }

    // Check if we have total
    if (extractedData.total_pedido && extractedData.total_pedido > 0) {
      score += 0.1;
    }

    // Check if we have order details
    if (extractedData.numero_pedido || extractedData.cliente || extractedData.fecha_pedido) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Validate extracted order data
   */
  static validateExtractedData(extractedData) {
    const errors = [];

    if (!extractedData.productos || extractedData.productos.length === 0) {
      errors.push('No products found in extracted data');
    }

    extractedData.productos?.forEach((product, index) => {
      if (!product.nombre_producto) {
        errors.push(`Product ${index + 1}: Missing product name`);
      }
      if (!product.cantidad || product.cantidad <= 0) {
        errors.push(`Product ${index + 1}: Invalid quantity`);
      }
      if (!product.precio_unitario || product.precio_unitario <= 0) {
        errors.push(`Product ${index + 1}: Invalid unit price`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default AIProcessor;