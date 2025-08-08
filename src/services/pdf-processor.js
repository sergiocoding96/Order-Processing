import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import pdf2pic from 'pdf2pic';
import { analyzeVisualContent, processTextWithFallback } from '../config/ai.js';
import logger from '../utils/logger.js';

export class PDFProcessor {
  
  /**
   * Process PDF file using streamlined approach:
   * Step 1: PDF → Image conversion (pdf2pic)
   * Step 2: GPT-4 Vision for visual processing and initial extraction
   * Step 3: DeepSeek R1 for reasoning, validation, and final structuring
   */
  static async processPDF(filePath, options = {}) {
    try {
      logger.info('Starting streamlined PDF processing', { filePath });

      // Step 1: Convert PDF to images
      const imageConversion = await this.convertPDFToImages(filePath);
      if (!imageConversion.success) {
        throw new Error(`PDF to image conversion failed: ${imageConversion.error}`);
      }

      // Step 2: Use GPT-4 Vision for initial visual analysis
      const visionResult = await this.processWithVision(imageConversion.images, options);
      if (!visionResult.success) {
        throw new Error(`GPT-4 Vision processing failed: ${visionResult.error}`);
      }

      // Step 3: Use reasoning chain (Gemini → DeepSeek → Claude) for final structuring
      const finalResult = await this.finalizeWithReasoning(visionResult.rawResponse, options);

      return {
        success: true,
        method: 'streamlined_pdf_processing',
        extractedData: finalResult.extractedData,
        confidence: finalResult.confidence,
        processingSteps: {
          imageConversion: imageConversion.pageCount,
          visionAnalysis: visionResult.confidence,
          reasoningValidation: finalResult.confidence
        }
      };

    } catch (error) {
      logger.error('Streamlined PDF processing failed', { filePath, error });
      throw error;
    }
  }

  /**
   * Extract text from PDF using pdf-parse
   */
  static async extractTextFromPDF(filePath) {
    try {
      logger.info('Attempting PDF text extraction', { filePath });
      
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      
      logger.info('PDF text extraction successful', { 
        textLength: pdfData.text.length,
        pageCount: pdfData.numpages 
      });
      
      return {
        success: true,
        text: pdfData.text,
        pageCount: pdfData.numpages,
        info: pdfData.info
      };
    } catch (error) {
      logger.error('PDF text extraction failed', { filePath, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Convert PDF to images using pdf2pic
   */
  static async convertPDFToImages(filePath) {
    try {
      logger.info('Converting PDF to images', { filePath });

      // Create temp directory
      const tempDir = path.join(path.dirname(filePath), 'temp_images');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const convert = pdf2pic.fromPath(filePath, {
        density: 200, // DPI - higher for better quality
        saveFilename: "page",
        savePath: tempDir,
        format: "png",
        width: 1200,
        height: 1600
      });

      // Convert first page only for performance
      const result = await convert(1); // Convert page 1
      
      if (!result) {
        throw new Error('No image generated from PDF');
      }
      
      const results = [result]; // Wrap single result in array for compatibility

      // Read the generated images as base64
      const images = [];
      for (const result of results) {
        const imagePath = result.path;
        if (fs.existsSync(imagePath)) {
          const imageBuffer = fs.readFileSync(imagePath);
          images.push({
            base64: imageBuffer.toString('base64'),
            page: result.page,
            path: imagePath
          });
        }
      }

      logger.info('PDF to image conversion successful', {
        filePath,
        pageCount: images.length,
        firstImageSize: images[0]?.base64.length || 0
      });

      return {
        success: true,
        images,
        pageCount: images.length
      };

    } catch (error) {
      logger.error('PDF to image conversion failed', { filePath, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process images with GPT-4 Vision for initial extraction
   */
  static async processWithVision(images, options = {}) {
    try {
      logger.info('Processing images with GPT-4 Vision', { imageCount: images.length });

      // For now, process first page (can be extended for multi-page)
      const firstImage = images[0];
      if (!firstImage) {
        throw new Error('No images to process');
      }

      const orderExtractionPrompt = `Analyze this Spanish invoice/order document image carefully and extract ALL product information.

CRITICAL BUSINESS ENTITY IDENTIFICATION:
- LEO 1987 SL / LEO FOODS / Similar "Leo" names = YOUR COMPANY (the seller/supplier)
- Do NOT confuse company logos or letterheads with customer information
- Customer/Cliente = The company BUYING from Leo (look for "Cliente:", "Facturar a:", "Ship to:")
- Look for customer details in billing/shipping sections, NOT in headers/logos

CRITICAL INSTRUCTIONS FOR TABLE/ROW DETECTION:
1. SCAN THE ENTIRE DOCUMENT systematically from top to bottom
2. IDENTIFY ALL TABLE ROWS - look for horizontal lines, alternating backgrounds, or consistent vertical alignment
3. EACH ROW typically contains: Product code/description | Quantity | Unit | Unit Price | Total
4. PAY ATTENTION TO:
   - Different font sizes (product codes vs descriptions)
   - Merged cells (product descriptions may span multiple lines)
   - Subtotals vs individual products
   - Continuation lines for long product names
   - Decimal separators (use comma for Spanish: 1.567,50 €)

EXTRACTION REQUIREMENTS:
- Order number (Pedido/Factura número): Look for patterns like "01/240053", "F-12345", "PED-xxxx"
- Customer details: The BUYER's company name, address, contact info (NOT Leo company info)
- Order date: Look for dates in DD/MM/YYYY or YYYY-MM-DD format
- ALL PRODUCTS: For each row/line item, extract:
  * Product name/description (including product codes like CET05R09)
  * Quantity (Cantidad/Cant.)
  * Unit of measure (Kg, Ud, etc.)
  * Unit price per item (Precio unitario)
  * Total price for that line (Total/Importe)
- Final total amount (Total general/Total factura)
- Payment terms, shipping costs, taxes, notes

SPANISH TERMS TO RECOGNIZE:
- Cliente/Customer = Buyer (NOT Leo)
- Facturar a = Bill to address
- Entregar a = Ship to address
- Cantidad/Cant. = Quantity
- Precio = Price
- Importe/Total = Amount
- Kg = Kilograms
- Ud/Unidad = Units
- Descripción = Description
- PORTES = Shipping
- IVA = Tax

OUTPUT FORMAT: First identify Leo as the supplier/seller, then find the actual CUSTOMER/BUYER information. Provide detailed observations, then extract data systematically, ensuring you capture EVERY product line item visible in the document.`;

      const result = await analyzeVisualContent(firstImage.base64, orderExtractionPrompt, {
        model: 'gpt-4o',
        maxTokens: 4000,
        temperature: 0.1
      });

      // Clean up temporary image files
      this.cleanupTempImages(images);

      return {
        success: true,
        rawResponse: result.content,
        confidence: 0.8, // Base confidence for vision processing
        usage: result.usage
      };

    } catch (error) {
      logger.error('GPT-4 Vision processing failed', error);
      throw error;
    }
  }

  /**
   * Use DeepSeek R1 for reasoning and final data structuring
   */
  static async finalizeWithReasoning(visionAnalysis, options = {}) {
    try {
      logger.info('Using DeepSeek R1 for final reasoning and structuring');

      const reasoningPrompt = `Based on the following GPT-4 Vision analysis of a Spanish order PDF, extract and structure the order information into a precise JSON format.

Vision Analysis:
${visionAnalysis}

Your task is to reason through the extracted information and create a structured JSON response. Use your reasoning capabilities to:
1. Validate the extracted information
2. Fill in any missing details logically
3. Ensure price calculations are correct
4. Structure the data properly

Return ONLY a valid JSON object in this exact format:
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
- Verify and correct calculations if needed
- Return ONLY the JSON object, no other text`;

      // Try reasoning with fallback chain, handling JSON parsing at each step
      let extractedData;
      let result;
      
      try {
        result = await processTextWithFallback(reasoningPrompt, {
          maxTokens: 4000,
          temperature: 0.1,
          responseFormat: { type: 'json_object' }
        });
        
        // Try to parse JSON from the successful provider
        extractedData = this.parseJSONFromProvider(result);
        
      } catch (chainError) {
        logger.error('All reasoning providers failed', chainError);
        throw new Error(`Reasoning chain failed: ${chainError.message}`);
      }

      // Calculate confidence based on data completeness
      const confidence = this.calculateProcessingConfidence(extractedData);

      return {
        success: true,
        extractedData,
        confidence,
        provider: result.provider,
        usage: result.usage
      };

    } catch (error) {
      logger.error('DeepSeek R1 reasoning failed', error);
      throw error;
    }
  }

  /**
   * Parse JSON from different AI provider response formats
   */
  static parseJSONFromProvider(result) {
    try {
      let jsonContent = result.content;
      
      // Handle different provider response formats
      if (result.provider === 'deepseek') {
        // DeepSeek R1 includes reasoning text, extract JSON from response
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonContent = jsonMatch[0];
        }
      } else if (result.provider === 'gemini') {
        // Handle Gemini edge cases first
        if (!result.content || result.content.trim().length === 0) {
          throw new Error('GEMINI_EMPTY_RESPONSE');
        }
        
        // Check for truncated JSON response
        if (result.content.includes('"nombre_') && !result.content.trim().endsWith('}')) {
          logger.warn('Detected truncated Gemini response, attempting JSON repair');
          
          const openBraces = (result.content.match(/\{/g) || []).length;
          const closeBraces = (result.content.match(/\}/g) || []).length;
          
          if (openBraces > closeBraces) {
            // Try to close the JSON structure
            let repairAttempt = result.content;
            repairAttempt = repairAttempt.replace(/,\s*{\s*"nombre_[^}]*$/, '');
            repairAttempt += '\n  ],\n  "total_pedido": null,\n  "observaciones": "Data truncated - partial extraction"\n}';
            
            const parsed = JSON.parse(repairAttempt);
            logger.info('Successfully repaired truncated JSON from Gemini');
            return parsed;
          }
        }
        
        // Normal Gemini parsing
        const jsonMatch = result.content.match(/```json\s*(\{[\s\S]*?\})\s*```/) || 
                         result.content.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1] || jsonMatch[0];
        }
        jsonContent = jsonContent.replace(/```json|```/g, '').trim();
        
      } else if (result.provider === 'claude') {
        // Claude may wrap JSON, extract it
        const jsonMatch = result.content.match(/```json\s*(\{[\s\S]*?\})\s*```/) || 
                         result.content.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1] || jsonMatch[0];
        }
      }
      
      // Clean up any remaining whitespace or formatting
      jsonContent = jsonContent.trim();
      
      const parsed = JSON.parse(jsonContent);
      
      logger.info('Successfully parsed JSON from reasoning response', {
        provider: result.provider,
        extractedFields: Object.keys(parsed)
      });
      
      return parsed;
      
    } catch (parseError) {
      logger.warn('JSON parsing failed for provider', {
        provider: result.provider,
        error: parseError.message,
        contentPreview: result.content.substring(0, 200) + '...'
      });
      
      // If this is a Gemini error that should trigger fallback
      if (result.provider === 'gemini' && 
          (parseError.message === 'GEMINI_EMPTY_RESPONSE' || 
           parseError.message.includes('Unexpected end'))) {
        throw new Error('GEMINI_PARSING_FAILED');
      }
      
      // For other providers or non-recoverable errors
      throw new Error(`JSON parsing failed for ${result.provider}: ${parseError.message}`);
    }
  }

  /**
   * Clean up temporary image files
   */
  static cleanupTempImages(images) {
    try {
      images.forEach(image => {
        if (fs.existsSync(image.path)) {
          fs.unlinkSync(image.path);
        }
      });
      
      // Remove temp directory if empty
      const tempDir = path.dirname(images[0]?.path);
      if (tempDir && fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        if (files.length === 0) {
          fs.rmdirSync(tempDir);
        }
      }
    } catch (error) {
      logger.warn('Failed to cleanup temporary images', { error: error.message });
    }
  }

  /**
   * Calculate confidence score for processing result
   */
  static calculateProcessingConfidence(extractedData) {
    let score = 0.0;
    
    // Check if we have products (most important)
    if (extractedData.productos && extractedData.productos.length > 0) {
      score += 0.5;
      
      // Check product completeness
      const completeProducts = extractedData.productos.filter(p => 
        p.nombre_producto && p.cantidad && p.precio_unitario
      );
      score += (completeProducts.length / extractedData.productos.length) * 0.3;
    }
    
    // Check if we have total
    if (extractedData.total_pedido && extractedData.total_pedido > 0) {
      score += 0.1;
    }
    
    // Check if we have order metadata
    if (extractedData.numero_pedido || extractedData.cliente || extractedData.fecha_pedido) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Determine if PDF is text-based or image-based
   */
  static async analyzePDFType(filePath) {
    try {
      const textResult = await this.extractTextFromPDF(filePath);
      
      if (!textResult.success) {
        return { type: 'image-based', confidence: 0.9 };
      }

      const textLength = textResult.text.trim().length;
      const wordCount = textResult.text.trim().split(/\s+/).length;

      // Heuristics to determine if PDF is primarily text or image-based
      if (textLength < 100 || wordCount < 20) {
        return { type: 'image-based', confidence: 0.8 };
      }

      // Check for meaningful content patterns
      const hasOrderPatterns = /precio|total|cantidad|pedido|order|€|\$/i.test(textResult.text);
      
      if (hasOrderPatterns) {
        return { type: 'text-based', confidence: 0.9 };
      }

      return { type: 'text-based', confidence: 0.6 };

    } catch (error) {
      logger.error('PDF type analysis failed', error);
      return { type: 'unknown', confidence: 0.1 };
    }
  }

  /**
   * Clean and preprocess extracted PDF text
   */
  static cleanPDFText(text) {
    if (!text) return '';

    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove page numbers and headers/footers (basic)
      .replace(/^\d+\s*$/gm, '')
      // Remove empty lines
      .replace(/^\s*\n/gm, '')
      // Trim
      .trim();
  }

  /**
   * Extract order-relevant sections from PDF text
   */
  static extractOrderSections(text) {
    const sections = {
      products: [],
      totals: [],
      metadata: []
    };

    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for product lines (Spanish format)
      const productMatch = line.match(/([A-ZÁÉÍÓÚÑ\s]+)\s+(Kilogramo|Litro|Unidad|Pieza)\s+(\d+(?:,\d+)?)\s+(\d+,\d+)\s*€/i);
      if (productMatch) {
        sections.products.push(line);
        continue;
      }

      // Look for total lines
      if (/total|subtotal|suma/i.test(line) && /€|\d+,\d+/.test(line)) {
        sections.totals.push(line);
        continue;
      }

      // Look for metadata (dates, order numbers, etc.)
      if (/pedido|order|fecha|date|cliente|customer/i.test(line)) {
        sections.metadata.push(line);
      }
    }

    return sections;
  }

  /**
   * Validate PDF processing result
   */
  static validatePDFResult(result) {
    const validation = {
      valid: false,
      issues: []
    };

    if (!result.success) {
      validation.issues.push('Processing failed');
      return validation;
    }

    if (!result.content || result.content.trim().length === 0) {
      validation.issues.push('No content extracted');
      return validation;
    }

    // Check for minimum content length
    if (result.content.trim().length < 20) {
      validation.issues.push('Insufficient content extracted');
    }

    // Check for order-related keywords
    const hasOrderKeywords = /precio|total|cantidad|pedido|€/i.test(result.content);
    if (!hasOrderKeywords) {
      validation.issues.push('No order-related content detected');
    }

    validation.valid = validation.issues.length === 0;
    return validation;
  }
}

export default PDFProcessor;