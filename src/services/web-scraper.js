import puppeteer from 'puppeteer';
import { analyzeVisualContent } from '../config/ai.js';
import logger from '../utils/logger.js';

export class WebScraper {
  
  /**
   * Scrape content from URL and extract order data
   */
  static async scrapeURL(url, options = {}) {
    let browser = null;
    
    try {
      logger.info('Starting web scraping', { url });

      // Launch browser
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();
      
      // Set user agent to avoid bot detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Set viewport
      await page.setViewport({ width: 1280, height: 720 });

      // Navigate to URL with timeout
      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: options.timeout || 30000 
      });

      // Wait for content to load
      await page.waitForTimeout(2000);

      // Determine scraping strategy based on URL
      const strategy = this.determineScrapingStrategy(url);
      
      let result;
      switch (strategy.type) {
        case 'ecommerce':
          result = await this.scrapeEcommercePage(page, url);
          break;
        case 'pdf_link':
          result = await this.downloadPDF(page, url);
          break;
        case 'image_link':
          result = await this.processImageLink(page, url);
          break;
        default:
          result = await this.scrapeGeneralPage(page, url);
      }

      await browser.close();
      
      logger.info('Web scraping completed', { 
        url, 
        strategy: strategy.type,
        success: result.success 
      });
      
      return result;

    } catch (error) {
      if (browser) {
        await browser.close();
      }
      
      logger.error('Web scraping failed', { url, error });
      throw error;
    }
  }

  /**
   * Determine scraping strategy based on URL
   */
  static determineScrapingStrategy(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname.toLowerCase();

      // E-commerce sites
      const ecommerceSites = ['amazon', 'ebay', 'mercadolibre', 'aliexpress', 'shopify'];
      if (ecommerceSites.some(site => hostname.includes(site))) {
        return { type: 'ecommerce', confidence: 0.9 };
      }

      // Direct PDF links
      if (pathname.endsWith('.pdf')) {
        return { type: 'pdf_link', confidence: 0.95 };
      }

      // Direct image links
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
      if (imageExtensions.some(ext => pathname.endsWith(ext))) {
        return { type: 'image_link', confidence: 0.9 };
      }

      return { type: 'general', confidence: 0.5 };
    } catch (error) {
      return { type: 'general', confidence: 0.1 };
    }
  }

  /**
   * Scrape e-commerce page for order information
   */
  static async scrapeEcommercePage(page, url) {
    try {
      // Common e-commerce selectors for order information
      const selectors = {
        products: [
          '.product-title, .item-title, .product-name',
          '.product-price, .price, .item-price',
          '.quantity, .qty, .item-quantity',
          '.order-item, .cart-item, .product-item'
        ],
        totals: [
          '.total, .grand-total, .order-total',
          '.subtotal, .sub-total',
          '.tax, .shipping'
        ],
        orderInfo: [
          '.order-number, .order-id',
          '.order-date, .purchase-date',
          '.customer-name, .billing-name'
        ]
      };

      // Take screenshot for visual analysis
      const screenshot = await page.screenshot({ 
        encoding: 'base64',
        fullPage: true
      });

      // Extract text content
      const textContent = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style');
        scripts.forEach(el => el.remove());
        
        return document.body.innerText;
      });

      // Try to extract structured data using selectors
      const structuredData = await this.extractStructuredData(page, selectors);

      return {
        success: true,
        method: 'ecommerce_scraping',
        textContent: textContent.substring(0, 5000), // Limit text length
        structuredData,
        screenshot: screenshot,
        url
      };

    } catch (error) {
      logger.error('E-commerce scraping failed', { url, error });
      return {
        success: false,
        error: error.message,
        method: 'ecommerce_scraping'
      };
    }
  }

  /**
   * Download PDF from URL
   */
  static async downloadPDF(page, url) {
    try {
      // Navigate directly to PDF
      const response = await page.goto(url);
      const buffer = await response.buffer();

      return {
        success: true,
        method: 'pdf_download',
        content: buffer,
        contentType: 'application/pdf',
        url
      };

    } catch (error) {
      logger.error('PDF download failed', { url, error });
      return {
        success: false,
        error: error.message,
        method: 'pdf_download'
      };
    }
  }

  /**
   * Process image link
   */
  static async processImageLink(page, url) {
    try {
      // Navigate to image
      await page.goto(url);
      
      // Take screenshot or get image buffer
      const screenshot = await page.screenshot({ 
        encoding: 'base64',
        fullPage: true
      });

      return {
        success: true,
        method: 'image_processing',
        imageData: screenshot,
        url
      };

    } catch (error) {
      logger.error('Image processing failed', { url, error });
      return {
        success: false,
        error: error.message,
        method: 'image_processing'
      };
    }
  }

  /**
   * Scrape general web page
   */
  static async scrapeGeneralPage(page, url) {
    try {
      // Take screenshot for visual analysis
      const screenshot = await page.screenshot({ 
        encoding: 'base64',
        fullPage: true
      });

      // Extract text content
      const textContent = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, nav, header, footer');
        scripts.forEach(el => el.remove());
        
        return document.body.innerText;
      });

      // Look for order-related content in the text
      const hasOrderContent = /pedido|order|precio|price|total|cantidad|quantity|€|\$/i.test(textContent);

      return {
        success: true,
        method: 'general_scraping',
        textContent: textContent.substring(0, 5000),
        screenshot: screenshot,
        hasOrderContent,
        url
      };

    } catch (error) {
      logger.error('General scraping failed', { url, error });
      return {
        success: false,
        error: error.message,
        method: 'general_scraping'
      };
    }
  }

  /**
   * Extract structured data using CSS selectors
   */
  static async extractStructuredData(page, selectors) {
    try {
      const data = await page.evaluate((selectors) => {
        const result = {
          products: [],
          totals: [],
          orderInfo: []
        };

        // Extract products
        selectors.products.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            if (el.textContent.trim()) {
              result.products.push(el.textContent.trim());
            }
          });
        });

        // Extract totals
        selectors.totals.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            if (el.textContent.trim()) {
              result.totals.push(el.textContent.trim());
            }
          });
        });

        // Extract order info
        selectors.orderInfo.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            if (el.textContent.trim()) {
              result.orderInfo.push(el.textContent.trim());
            }
          });
        });

        return result;
      }, selectors);

      return data;
    } catch (error) {
      logger.error('Structured data extraction failed', error);
      return { products: [], totals: [], orderInfo: [] };
    }
  }

  /**
   * Process scraped content with AI
   */
  static async processScrapedContent(scrapedResult) {
    try {
      if (!scrapedResult.success) {
        throw new Error('Scraping failed: ' + scrapedResult.error);
      }

      // If we have a screenshot, use GPT-4 Vision
      if (scrapedResult.screenshot) {
        const prompt = `Analyze this webpage screenshot and extract any order information you can find.

Look for:
- Product names and descriptions
- Quantities and units
- Prices (individual and totals)
- Order numbers or references
- Customer information
- Dates

Return the information in JSON format:
{
  "numero_pedido": "order number if visible",
  "cliente": "customer name if visible",
  "fecha_pedido": "date in YYYY-MM-DD format if visible", 
  "productos": [
    {
      "nombre_producto": "product name",
      "cantidad": number,
      "unidad": "unit",
      "precio_unitario": number,
      "total_producto": number
    }
  ],
  "total_pedido": number,
  "observaciones": "any additional notes"
}`;

        const visionResult = await analyzeVisualContent(
          scrapedResult.screenshot,
          prompt,
          { maxTokens: 2000, temperature: 0.1 }
        );

        return {
          success: true,
          method: 'vision_analysis',
          extractedData: this.parseAIResponse(visionResult.content),
          rawResponse: visionResult.content
        };
      }

      // Fallback to text processing if no screenshot
      if (scrapedResult.textContent) {
        return {
          success: true,
          method: 'text_extraction',
          extractedData: this.extractDataFromText(scrapedResult.textContent),
          textContent: scrapedResult.textContent
        };
      }

      throw new Error('No processable content found');

    } catch (error) {
      logger.error('Scraped content processing failed', error);
      throw error;
    }
  }

  /**
   * Parse AI response to extract JSON
   */
  static parseAIResponse(response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No JSON found in response');
    } catch (error) {
      // Fallback to text extraction
      return this.extractDataFromText(response);
    }
  }

  /**
   * Extract basic data from text content
   */
  static extractDataFromText(text) {
    return {
      numero_pedido: null,
      cliente: null,
      fecha_pedido: null,
      productos: [],
      total_pedido: null,
      observaciones: `Scraped content: ${text.substring(0, 500)}...`
    };
  }

  /**
   * Validate scraped URL before processing
   */
  static validateURL(url) {
    try {
      const urlObj = new URL(url);
      
      // Only allow HTTP/HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { valid: false, error: 'Only HTTP/HTTPS URLs allowed' };
      }

      // Block localhost and private IPs in production
      if (process.env.NODE_ENV === 'production') {
        const hostname = urlObj.hostname.toLowerCase();
        const privateRanges = [
          'localhost', '127.0.0.1', '0.0.0.0',
          '10.', '172.16.', '172.17.', '172.18.', '172.19.',
          '172.2', '172.3', '192.168.'
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
}

export default WebScraper;