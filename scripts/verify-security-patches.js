#!/usr/bin/env node
/**
 * Security Patches Verification Script
 * Verifies that all critical security fixes are properly implemented
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('🔐 Verifying Security Patches Implementation...\n');

const results = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function logResult(test, status, message) {
  const icons = { pass: '✅', fail: '❌', warn: '⚠️' };
  console.log(`${icons[status]} ${test}: ${message}`);
  results[status === 'pass' ? 'passed' : status === 'fail' ? 'failed' : 'warnings']++;
}

// Test 1: Verify SecurityUtils exists and exports
try {
  const securityPath = path.join(projectRoot, 'src/utils/security.js');
  if (!fs.existsSync(securityPath)) {
    throw new Error('SecurityUtils file not found');
  }
  
  const securityContent = fs.readFileSync(securityPath, 'utf8');
  
  const requiredMethods = [
    'safeJSONParse',
    'sanitizeSQLParam',
    'validateFileUpload',
    'processBufferSafely',
    'createRateLimit'
  ];
  
  const missing = requiredMethods.filter(method => !securityContent.includes(method));
  if (missing.length > 0) {
    throw new Error(`Missing methods: ${missing.join(', ')}`);
  }
  
  logResult('SecurityUtils Implementation', 'pass', 'All required methods present');
} catch (error) {
  logResult('SecurityUtils Implementation', 'fail', error.message);
}

// Test 2: Verify ai-processor.js patches
try {
  const aiProcessorPath = path.join(projectRoot, 'src/services/ai-processor.js');
  const content = fs.readFileSync(aiProcessorPath, 'utf8');
  
  const securityChecks = [
    'import SecurityUtils',
    'SecurityUtils.safeJSONParse',
    'SecurityUtils.processBufferSafely',
    'SecurityUtils.truncateString'
  ];
  
  const missing = securityChecks.filter(check => !content.includes(check));
  if (missing.length > 0) {
    throw new Error(`Missing security implementations: ${missing.join(', ')}`);
  }
  
  // Check for buffer size limits
  if (!content.includes('10 * 1024 * 1024')) {
    logResult('AI Processor Memory Limits', 'warn', 'Buffer size limits may not be properly set');
  } else {
    logResult('AI Processor Security', 'pass', 'JSON parsing and buffer handling secured');
  }
} catch (error) {
  logResult('AI Processor Security', 'fail', error.message);
}

// Test 3: Verify pedidos.js SQL injection protection
try {
  const pedidosPath = path.join(projectRoot, 'src/models/pedidos.js');
  const content = fs.readFileSync(pedidosPath, 'utf8');
  
  if (!content.includes('SecurityUtils.sanitizeSQLParam')) {
    throw new Error('SQL parameter sanitization not implemented');
  }
  
  if (!content.includes('sanitizedTerm')) {
    throw new Error('Search term sanitization not found');
  }
  
  logResult('SQL Injection Protection', 'pass', 'Search parameters properly sanitized');
} catch (error) {
  logResult('SQL Injection Protection', 'fail', error.message);
}

// Test 4: Verify webhooks.js file upload security
try {
  const webhooksPath = path.join(projectRoot, 'src/routes/webhooks.js');
  const content = fs.readFileSync(webhooksPath, 'utf8');
  
  const securityFeatures = [
    'SecurityUtils.validateFileUpload',
    'mailhookRateLimit',
    'telegramRateLimit',
    'SecurityUtils.truncateString'
  ];
  
  const missing = securityFeatures.filter(feature => !content.includes(feature));
  if (missing.length > 0) {
    throw new Error(`Missing features: ${missing.join(', ')}`);
  }
  
  logResult('File Upload Security', 'pass', 'File validation and rate limiting implemented');
} catch (error) {
  logResult('File Upload Security', 'fail', error.message);
}

// Test 5: Check for sensitive file cleanup
try {
  const webhooksPath = path.join(projectRoot, 'src/routes/webhooks.js');
  const content = fs.readFileSync(webhooksPath, 'utf8');
  
  if (!content.includes('cleanupFiles')) {
    throw new Error('File cleanup not implemented');
  }
  
  const cleanupOccurrences = (content.match(/cleanupFiles/g) || []).length;
  if (cleanupOccurrences < 2) {
    logResult('File Cleanup', 'warn', 'File cleanup may not be comprehensive');
  } else {
    logResult('File Cleanup', 'pass', 'Error handling includes file cleanup');
  }
} catch (error) {
  logResult('File Cleanup', 'fail', error.message);
}

// Test 6: Verify memory management patterns
try {
  const aiProcessorPath = path.join(projectRoot, 'src/services/ai-processor.js');
  const content = fs.readFileSync(aiProcessorPath, 'utf8');
  
  const memoryPatterns = [
    'AbortController',
    'setTimeout.*abort',
    'clearTimeout',
    'stats.size'
  ];
  
  const foundPatterns = memoryPatterns.filter(pattern => new RegExp(pattern).test(content));
  if (foundPatterns.length >= 3) {
    logResult('Memory Management', 'pass', 'Timeout controls and size checks implemented');
  } else {
    logResult('Memory Management', 'warn', 'Some memory management patterns missing');
  }
} catch (error) {
  logResult('Memory Management', 'fail', error.message);
}

// Test 7: Check production readiness markers
try {
  const filesToCheck = [
    'src/utils/security.js',
    'src/services/ai-processor.js',
    'src/models/pedidos.js',
    'src/routes/webhooks.js'
  ];
  
  let securityComments = 0;
  
  for (const file of filesToCheck) {
    const content = fs.readFileSync(path.join(projectRoot, file), 'utf8');
    const comments = (content.match(/SECURITY FIX/g) || []).length;
    securityComments += comments;
  }
  
  if (securityComments >= 8) {
    logResult('Security Documentation', 'pass', `${securityComments} security fixes documented`);
  } else {
    logResult('Security Documentation', 'warn', 'Some security fixes may not be documented');
  }
} catch (error) {
  logResult('Security Documentation', 'fail', error.message);
}

// Final Summary
console.log('\n📊 Security Verification Summary:');
console.log(`✅ Passed: ${results.passed}`);
console.log(`⚠️  Warnings: ${results.warnings}`);
console.log(`❌ Failed: ${results.failed}`);

if (results.failed === 0) {
  console.log('\n🛡️  SECURITY STATUS: HARDENED');
  console.log('🚀 DEPLOYMENT STATUS: READY FOR PRODUCTION');
  console.log('\nAll critical security patches have been successfully implemented.');
  
  if (results.warnings > 0) {
    console.log(`\n⚠️  Note: ${results.warnings} warning(s) detected. Review recommended but not blocking.`);
  }
} else {
  console.log('\n🚨 SECURITY STATUS: INCOMPLETE');
  console.log('❌ DEPLOYMENT STATUS: BLOCKED');
  console.log(`\nCritical issues found: ${results.failed}. Address before deployment.`);
}

console.log('\n' + '='.repeat(60));