#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';

// Determine the config file path based on the OS
function getConfigPath() {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  switch (platform) {
    case 'darwin': // macOS
      return path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32': // Windows
      return path.join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json');
    case 'linux': // Linux
      return path.join(homeDir, '.config', 'Claude', 'claude_desktop_config.json');
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

// Extract project reference from Supabase URL
function extractProjectRef(url) {
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : null;
}

async function setupMCP() {
  try {
    const configPath = getConfigPath();
    const projectRef = extractProjectRef('https://xblcxpufqwmgshscnmvy.supabase.co');
    
    if (!projectRef) {
      console.error('❌ Could not extract project reference from Supabase URL');
      return;
    }

    console.log(`📍 Config path: ${configPath}`);
    console.log(`🔑 Project ref: ${projectRef}`);
    
    // Create directory if it doesn't exist
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      console.log(`📁 Created config directory: ${configDir}`);
    }
    
    // Read existing config or create new one
    let config = {};
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(configData);
      console.log('📖 Found existing config file');
    } else {
      console.log('📝 Creating new config file');
    }
    
    // Add or update MCP servers configuration
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    
    config.mcpServers.supabase = {
      command: "npx",
      args: [
        "-y", 
        "@supabase/mcp-server-supabase@latest", 
        `--project-ref=${projectRef}`
      ],
      env: {
        SUPABASE_SERVICE_ROLE_KEY: "sb_secret_SKgeFp4Z8VhcsOck1eCrOQ_jLpj4G1N"
      }
    };
    
    // Write the updated config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log('✅ MCP configuration updated successfully!');
    console.log('🔄 Please restart Claude Code to apply the changes');
    console.log('\n📋 Configuration added:');
    console.log(JSON.stringify(config.mcpServers.supabase, null, 2));
    
  } catch (error) {
    console.error('❌ Error setting up MCP configuration:', error.message);
    console.log('\n🛠️  Manual setup instructions:');
    console.log('1. Find your Claude Code config file:');
    console.log('   - macOS: ~/Library/Application Support/Claude/claude_desktop_config.json');
    console.log('   - Windows: %APPDATA%\\Claude\\claude_desktop_config.json');
    console.log('   - Linux: ~/.config/Claude/claude_desktop_config.json');
    console.log('\n2. Add this configuration:');
    console.log(JSON.stringify({
      mcpServers: {
        supabase: {
          command: "npx",
          args: [
            "-y", 
            "@supabase/mcp-server-supabase@latest", 
            `--project-ref=${projectRef || 'xblcxpufqwmgshscnmvy'}`
          ],
          env: {
            SUPABASE_SERVICE_ROLE_KEY: "sb_secret_SKgeFp4Z8VhcsOck1eCrOQ_jLpj4G1N"
          }
        }
      }
    }, null, 2));
  }
}

setupMCP();