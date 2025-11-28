#!/usr/bin/env node

/**
 * Test script that communicates with react-context-mcp via JSON-RPC
 * to test get_component_map on a real application
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let requestId = 0;

function sendRequest(process, method, params = {}) {
  const id = ++requestId;
  const request = {
    jsonrpc: '2.0',
    id,
    method,
    params,
  };

  console.error(`\n→ Sending: ${method}`);
  process.stdin.write(JSON.stringify(request) + '\n');
  return id;
}

async function main() {
  const targetUrl = process.env.TARGET_URL || 'http://localhost:5174';

  console.error(`Testing react-context-mcp with target: ${targetUrl}`);
  console.error('='.repeat(60));

  // Spawn the MCP server
  const serverPath = join(__dirname, 'build/src/main.js');
  const mcpServer = spawn('node', [serverPath, '--isolated', '--headless'], {
    env: { ...process.env, TARGET_URL: targetUrl },
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  let responseBuffer = '';
  const responses = new Map();

  mcpServer.stdout.on('data', (data) => {
    responseBuffer += data.toString();

    // Process complete JSON-RPC messages
    const lines = responseBuffer.split('\n');
    responseBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const response = JSON.parse(line);
        console.error(`\n← Received: ${response.result ? 'result' : response.error ? 'error' : 'notification'}`);

        if (response.id !== undefined) {
          responses.set(response.id, response);
        }
      } catch (e) {
        console.error('Failed to parse response:', line);
      }
    }
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 1: Initialize
  const initId = sendRequest(mcpServer, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' },
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 2: List pages
  const listPagesId = sendRequest(mcpServer, 'tools/call', {
    name: 'list_pages',
    arguments: {},
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 3: Try get_component_map
  console.error('\n→ Calling get_component_map...');
  const componentMapId = sendRequest(mcpServer, 'tools/call', {
    name: 'get_component_map',
    arguments: { verbose: true },
  });

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 10000));

  const componentMapResponse = responses.get(componentMapId);
  if (componentMapResponse) {
    if (componentMapResponse.error) {
      console.error('\n❌ Error:', componentMapResponse.error.message);
      console.error('Details:', JSON.stringify(componentMapResponse.error, null, 2));
    } else if (componentMapResponse.result) {
      console.error('\n✅ Success! Component map received');
      console.log('\n' + '='.repeat(60));
      console.log('COMPONENT MAP:');
      console.log('='.repeat(60));

      const content = componentMapResponse.result.content;
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.type === 'text') {
            console.log(item.text);
          }
        }
      } else {
        console.log(JSON.stringify(content, null, 2));
      }
    }
  } else {
    console.error('\n⏱️  No response received for get_component_map');
  }

  // Cleanup
  mcpServer.kill();

  console.error('\n' + '='.repeat(60));
  console.error('Test complete');
}

main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
