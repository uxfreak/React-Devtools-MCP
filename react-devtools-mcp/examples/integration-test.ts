#!/usr/bin/env -S npx tsx

/**
 * EXAMPLE Integration Test
 *
 * This is an example showing how to test the equivalence of ARIA vs CDP approaches
 * for finding React components. Customize the values below for your React app.
 *
 * This test verifies that both approaches return equivalent results:
 * 1. ARIA selector approach (get_react_component_from_snapshot)
 * 2. CDP backendDOMNodeId approach (get_react_component_from_backend_node_id)
 *
 * Environment variables:
 * - TARGET_URL: URL of your React app (default: http://localhost:3000)
 * - TEST_ROLE: Accessible role to search for (default: button)
 * - TEST_NAME: Accessible name to search for (default: Submit)
 */

import {spawn} from 'child_process';
import {once} from 'events';

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const TEST_ROLE = process.env.TEST_ROLE || 'button';
const TEST_NAME = process.env.TEST_NAME || 'Submit';

interface McpMessage {
  jsonrpc: string;
  id?: string;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

interface ComponentData {
  success: boolean;
  component?: {
    name: string;
    type: string;
    props?: any;
    state?: any;
    source?: any;
    owners?: any[];
  };
  error?: string;
}

async function runMcpTest() {
  console.log('Starting integration test: ARIA vs CDP approaches\n');

  // Start MCP server
  const serverProcess = spawn('node', ['build/src/main.js', '--isolated', '--headless'], {
    cwd: process.cwd(),
    env: {...process.env, TARGET_URL},
  });

  const responses = new Map<string, any>();
  let initResponseReceived = false;

  // Collect responses
  serverProcess.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n').filter((l: string) => l.trim());
    for (const line of lines) {
      try {
        const msg: McpMessage = JSON.parse(line);
        if (msg.id) {
          responses.set(msg.id, msg);
          if (msg.id === 'init') {
            initResponseReceived = true;
          }
        }
      } catch (e) {
        // Ignore non-JSON lines
      }
    }
  });

  serverProcess.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    if (!text.includes('Warning:') && !text.includes('DevTools')) {
      console.error('Server stderr:', text);
    }
  });

  // Send messages to server
  function send(msg: McpMessage) {
    serverProcess.stdin.write(JSON.stringify(msg) + '\n');
  }

  // Wait for initialization
  send({
    jsonrpc: '2.0',
    id: 'init',
    method: 'initialize',
    params: {
      protocolVersion: '2024-12-19',
      capabilities: {},
      clientInfo: {name: 'integration-test', version: '1.0.0'},
    },
  });

  // Wait for init response
  while (!initResponseReceived) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('✓ MCP server initialized\n');

  // Step 1: Take snapshot
  console.log('Step 1: Taking snapshot...');
  send({
    jsonrpc: '2.0',
    id: 'snapshot',
    method: 'tools/call',
    params: {name: 'take_snapshot', arguments: {verbose: true}},
  });

  while (!responses.has('snapshot')) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const snapshotResponse = responses.get('snapshot');
  if (snapshotResponse.error) {
    console.error('✗ Snapshot failed:', snapshotResponse.error);
    serverProcess.kill();
    process.exit(1);
  }

  const snapshotContent = JSON.parse(snapshotResponse.result.content[0].text);
  console.log('✓ Snapshot taken');
  console.log(`  Snapshot has ${Object.keys(snapshotContent).length} top-level keys: ${Object.keys(snapshotContent).join(', ')}\n`);

  // Step 2: Find backendDOMNodeId from snapshot
  console.log('Step 2: Finding backendDOMNodeId from snapshot...');

  function findNodeInTree(node: any, targetRole: string, targetName: string): any {
    if (node.role === targetRole && node.name === targetName) {
      return node;
    }
    if (node.children) {
      for (const child of node.children) {
        const found = findNodeInTree(child, targetRole, targetName);
        if (found) return found;
      }
    }
    return null;
  }

  const targetNode = findNodeInTree(snapshotContent.root, TEST_ROLE, TEST_NAME);

  if (!targetNode || !targetNode.backendDOMNodeId) {
    console.error(`✗ Could not find ${TEST_ROLE} "${TEST_NAME}" with backendDOMNodeId in snapshot`);
    console.error(`  Snapshot structure: ${JSON.stringify(snapshotContent, null, 2).substring(0, 500)}...`);
    serverProcess.kill();
    process.exit(1);
  }

  const backendDOMNodeId = targetNode.backendDOMNodeId;
  console.log(`✓ Found backendDOMNodeId: ${backendDOMNodeId}\n`);

  // Step 3: Test ARIA approach
  console.log('Step 3: Testing ARIA selector approach...');
  send({
    jsonrpc: '2.0',
    id: 'aria',
    method: 'tools/call',
    params: {
      name: 'get_react_component_from_snapshot',
      arguments: {role: TEST_ROLE, name: TEST_NAME},
    },
  });

  while (!responses.has('aria')) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const ariaResponse = responses.get('aria');
  if (ariaResponse.error) {
    console.error('✗ ARIA approach failed:', ariaResponse.error);
    serverProcess.kill();
    process.exit(1);
  }

  const ariaData: ComponentData = JSON.parse(ariaResponse.result.content[0].text);
  if (!ariaData.success) {
    console.error('✗ ARIA approach returned error:', ariaData.error);
    serverProcess.kill();
    process.exit(1);
  }

  console.log('✓ ARIA approach succeeded');
  console.log(`  Component: ${ariaData.component?.name} (${ariaData.component?.type})`);
  console.log(`  Owners: ${ariaData.component?.owners?.length || 0} components\n`);

  // Step 4: Test CDP approach
  console.log('Step 4: Testing CDP backendDOMNodeId approach...');
  send({
    jsonrpc: '2.0',
    id: 'cdp',
    method: 'tools/call',
    params: {
      name: 'get_react_component_from_backend_node_id',
      arguments: {backendDOMNodeId},
    },
  });

  while (!responses.has('cdp')) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const cdpResponse = responses.get('cdp');
  if (cdpResponse.error) {
    console.error('✗ CDP approach failed:', cdpResponse.error);
    serverProcess.kill();
    process.exit(1);
  }

  const cdpData: ComponentData = JSON.parse(cdpResponse.result.content[0].text);
  if (!cdpData.success) {
    console.error('✗ CDP approach returned error:', cdpData.error);
    serverProcess.kill();
    process.exit(1);
  }

  console.log('✓ CDP approach succeeded');
  console.log(`  Component: ${cdpData.component?.name} (${cdpData.component?.type})`);
  console.log(`  Owners: ${cdpData.component?.owners?.length || 0} components\n`);

  // Step 5: Compare results
  console.log('Step 5: Comparing results...\n');

  const ariaComp = ariaData.component!;
  const cdpComp = cdpData.component!;

  let allMatch = true;

  // Compare component name
  if (ariaComp.name !== cdpComp.name) {
    console.error(`✗ Component name mismatch:`);
    console.error(`  ARIA: ${ariaComp.name}`);
    console.error(`  CDP:  ${cdpComp.name}`);
    allMatch = false;
  } else {
    console.log(`✓ Component name matches: ${ariaComp.name}`);
  }

  // Compare component type
  if (ariaComp.type !== cdpComp.type) {
    console.error(`✗ Component type mismatch:`);
    console.error(`  ARIA: ${ariaComp.type}`);
    console.error(`  CDP:  ${cdpComp.type}`);
    allMatch = false;
  } else {
    console.log(`✓ Component type matches: ${ariaComp.type}`);
  }

  // Compare owners count
  const ariaOwnersCount = ariaComp.owners?.length || 0;
  const cdpOwnersCount = cdpComp.owners?.length || 0;

  if (ariaOwnersCount !== cdpOwnersCount) {
    console.error(`✗ Owners count mismatch:`);
    console.error(`  ARIA: ${ariaOwnersCount} owners`);
    console.error(`  CDP:  ${cdpOwnersCount} owners`);
    allMatch = false;
  } else {
    console.log(`✓ Owners count matches: ${ariaOwnersCount} owners`);
  }

  // Compare owner names (shallow comparison)
  if (ariaComp.owners && cdpComp.owners) {
    for (let i = 0; i < Math.min(ariaComp.owners.length, cdpComp.owners.length); i++) {
      if (ariaComp.owners[i].name !== cdpComp.owners[i].name) {
        console.error(`✗ Owner ${i} name mismatch:`);
        console.error(`  ARIA: ${ariaComp.owners[i].name}`);
        console.error(`  CDP:  ${cdpComp.owners[i].name}`);
        allMatch = false;
      }
    }
  }

  if (allMatch) {
    console.log('\n✓ All checks passed! ARIA and CDP approaches return equivalent results.');
  }

  // Compare source locations
  if (ariaComp.source && cdpComp.source) {
    if (
      ariaComp.source.fileName === cdpComp.source.fileName &&
      ariaComp.source.lineNumber === cdpComp.source.lineNumber &&
      ariaComp.source.columnNumber === cdpComp.source.columnNumber
    ) {
      console.log(`✓ Source location matches: ${ariaComp.source.fileName}:${ariaComp.source.lineNumber}:${ariaComp.source.columnNumber}`);
    } else {
      console.error(`✗ Source location mismatch:`);
      console.error(`  ARIA: ${JSON.stringify(ariaComp.source)}`);
      console.error(`  CDP:  ${JSON.stringify(cdpComp.source)}`);
      allMatch = false;
    }
  }

  serverProcess.kill();

  if (allMatch) {
    console.log('\n🎉 Integration test PASSED! Both approaches are equivalent.\n');
    process.exit(0);
  } else {
    console.log('\n❌ Integration test FAILED! Approaches returned different results.\n');
    process.exit(1);
  }
}

runMcpTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
