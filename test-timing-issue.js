#!/usr/bin/env node

/**
 * Test to reproduce the timing issue where get_component_map is called
 * too quickly after navigation, before React renderers are registered
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

  console.error(`\n→ [${new Date().toISOString()}] Sending: ${method}`);
  if (Object.keys(params).length > 0) {
    console.error(`  Params:`, JSON.stringify(params));
  }
  process.stdin.write(JSON.stringify(request) + '\n');
  return id;
}

async function main() {
  const targetUrl = process.env.TARGET_URL || 'http://localhost:5174';

  console.error(`Testing timing issue with: ${targetUrl}`);
  console.error('='.repeat(60));
  console.error('Strategy: Navigate to page, then immediately call get_component_map');
  console.error('Expected: First call may fail with "no renderers" error');
  console.error('='.repeat(60));

  // Spawn the MCP server
  const serverPath = join(__dirname, 'build/src/main.js');
  const mcpServer = spawn('node', [serverPath, '--isolated', '--headless'], {
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  let responseBuffer = '';
  const responses = new Map();

  mcpServer.stdout.on('data', (data) => {
    responseBuffer += data.toString();

    const lines = responseBuffer.split('\n');
    responseBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const response = JSON.parse(line);
        console.error(`← [${new Date().toISOString()}] Received response for ID ${response.id}`);

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
  console.error('\n' + '='.repeat(60));
  console.error('STEP 1: Initialize MCP server');
  console.error('='.repeat(60));
  const initId = sendRequest(mcpServer, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'timing-test', version: '1.0.0' },
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 2: Navigate to page
  console.error('\n' + '='.repeat(60));
  console.error('STEP 2: Navigate to page');
  console.error('='.repeat(60));
  const newPageId = sendRequest(mcpServer, 'tools/call', {
    name: 'new_page',
    arguments: { url: targetUrl },
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 3: IMMEDIATELY call get_component_map (this should reproduce the issue)
  console.error('\n' + '='.repeat(60));
  console.error('STEP 3: Call get_component_map IMMEDIATELY (may fail)');
  console.error('='.repeat(60));
  const componentMap1Id = sendRequest(mcpServer, 'tools/call', {
    name: 'get_component_map',
    arguments: { verbose: true },
  });

  await new Promise(resolve => setTimeout(resolve, 8000));

  // Step 4: Call again after delay (should succeed)
  console.error('\n' + '='.repeat(60));
  console.error('STEP 4: Call get_component_map after 8s delay (should succeed)');
  console.error('='.repeat(60));
  const componentMap2Id = sendRequest(mcpServer, 'tools/call', {
    name: 'get_component_map',
    arguments: { verbose: true },
  });

  await new Promise(resolve => setTimeout(resolve, 10000));

  // Analyze results
  console.error('\n' + '='.repeat(60));
  console.error('RESULTS:');
  console.error('='.repeat(60));

  const firstCallResponse = responses.get(componentMap1Id);
  const secondCallResponse = responses.get(componentMap2Id);

  console.error('\nFirst call (immediate):');
  if (firstCallResponse?.error) {
    console.error('  ❌ FAILED (as expected)');
    console.error('  Error:', firstCallResponse.error.message);
  } else if (firstCallResponse?.result) {
    const content = firstCallResponse.result.content;
    const text = Array.isArray(content) ? content.find(c => c.type === 'text')?.text : '';
    if (text?.includes('React DevTools hook not found or no renderers')) {
      console.error('  ❌ FAILED with "no renderers" (as expected)');
    } else if (text?.includes('React Component Tree:')) {
      console.error('  ✅ SUCCESS (unexpected - React mounted very quickly!)');
      console.error('  Component tree length:', text.split('\n').length, 'lines');
    } else {
      console.error('  ⚠️  Unexpected response');
    }
  } else {
    console.error('  ⏱️  No response received');
  }

  console.error('\nSecond call (after 8s delay):');
  if (secondCallResponse?.error) {
    console.error('  ❌ FAILED (unexpected)');
    console.error('  Error:', secondCallResponse.error.message);
  } else if (secondCallResponse?.result) {
    const content = secondCallResponse.result.content;
    const text = Array.isArray(content) ? content.find(c => c.type === 'text')?.text : '';
    if (text?.includes('React Component Tree:')) {
      console.error('  ✅ SUCCESS');
      console.error('  Component tree length:', text.split('\n').length, 'lines');
    } else if (text?.includes('React DevTools hook not found or no renderers')) {
      console.error('  ❌ Still failing with "no renderers"');
    } else {
      console.error('  ⚠️  Unexpected response');
    }
  } else {
    console.error('  ⏱️  No response received');
  }

  // Cleanup
  mcpServer.kill();

  console.error('\n' + '='.repeat(60));
  console.error('Test complete');
  console.error('='.repeat(60));

  // Exit with appropriate code
  const firstFailed = firstCallResponse?.error ||
                     firstCallResponse?.result?.content?.find?.(c => c.text?.includes('no renderers'));
  const secondSucceeded = secondCallResponse?.result?.content?.find?.(c =>
                         c.type === 'text' && c.text?.includes('React Component Tree:'));

  if (firstFailed && secondSucceeded) {
    console.error('\n✅ Successfully reproduced the timing issue!');
    console.error('   First call failed, second call succeeded.');
    process.exit(0);
  } else if (!firstFailed && secondSucceeded) {
    console.error('\n⚠️  Could not reproduce issue - React mounted too quickly');
    process.exit(0);
  } else {
    console.error('\n❌ Unexpected test results');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});
