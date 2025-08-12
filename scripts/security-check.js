#!/usr/bin/env node

/**
 * Pre-commit security check to prevent API key exposure
 * Run this before every commit to catch potential secrets
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SECURITY_PATTERNS = {
  openai: /sk-[a-zA-Z0-9]{32,}/g,
  google: /AIza[a-zA-Z0-9_-]{35}/g,
  supabase_service: /sb_secret_[a-zA-Z0-9_-]{24,}/g,
  supabase_anon: /sb_publishable_[a-zA-Z0-9_-]{24,}/g,
  telegram: /[0-9]{8,10}:[a-zA-Z0-9_-]{35}/g,
  generic_key: /(?:api[_-]?key|secret[_-]?key|access[_-]?token)[\s]*[:=][\s]*['"'][a-zA-Z0-9_-]{20,}/gi
};

const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage'];
const EXCLUDED_FILES = ['.env.example', '.env.production.template', '.env.render.template'];

function scanDirectory(dir) {
  const violations = [];
  
  function scanFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(process.cwd(), filePath);
      
      for (const [type, pattern] of Object.entries(SECURITY_PATTERNS)) {
        const matches = content.match(pattern);
        if (matches) {
          violations.push({
            file: relativePath,
            type,
            matches: matches.map(match => match.substring(0, 20) + '...')
          });
        }
      }
    } catch (error) {
      // Skip files we can't read
    }
  }
  
  function walkDirectory(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!EXCLUDED_DIRS.includes(item)) {
          walkDirectory(fullPath);
        }
      } else if (stat.isFile()) {
        const fileName = path.basename(fullPath);
        if (!EXCLUDED_FILES.includes(fileName) && !fileName.endsWith('.log')) {
          scanFile(fullPath);
        }
      }
    }
  }
  
  walkDirectory(dir);
  return violations;
}

function main() {
  console.log('🔍 Running security scan for API keys and secrets...\n');
  
  const projectRoot = path.resolve(__dirname, '..');
  const violations = scanDirectory(projectRoot);
  
  if (violations.length === 0) {
    console.log('✅ No security violations found!');
    console.log('✅ Safe to commit');
    process.exit(0);
  } else {
    console.log('❌ SECURITY VIOLATIONS DETECTED:\n');
    
    for (const violation of violations) {
      console.log(`🚨 ${violation.type.toUpperCase()} found in: ${violation.file}`);
      console.log(`   Detected: ${violation.matches.join(', ')}\n`);
    }
    
    console.log('❌ COMMIT BLOCKED - Remove all secrets before committing!');
    console.log('\n📋 Quick fixes:');
    console.log('1. Move secrets to .env file (already in .gitignore)');
    console.log('2. Use environment variables in your code');
    console.log('3. Remove backup files (*.bak, *.old, *.tmp)');
    console.log('4. Check template files don\'t contain real secrets');
    
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}