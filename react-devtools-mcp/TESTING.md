# Testing

This document describes the testing infrastructure for React DevTools MCP.

## Example Integration Test

The example integration test (`examples/integration-test.ts`) demonstrates how to verify that both element-to-component mapping approaches return equivalent results:

1. **ARIA Selector Approach** - Uses Puppeteer ARIA selectors to find elements
2. **CDP backendDOMNodeId Approach** - Uses Chrome DevTools Protocol Accessibility tree node IDs

### Running the Example Test

**Prerequisites:**
- A React development server running (default: `http://localhost:3000`)
- The React app must have an element with the specified accessible role and name

**Run the test:**

```bash
# With default settings (looks for a "Submit" button at localhost:3000)
npm run test:example

# With custom configuration
TARGET_URL=http://localhost:5173 TEST_ROLE=button TEST_NAME="Sign in" npm run test:example

# Or set in your shell
export TARGET_URL=http://localhost:5173
export TEST_ROLE=button
export TEST_NAME="Sign in"
npm run test:example
```

### Configuration

Customize the test using environment variables:

- `TARGET_URL`: URL of your React app (default: `http://localhost:3000`)
- `TEST_ROLE`: Accessible role to search for (default: `button`)
- `TEST_NAME`: Accessible name to search for (default: `Submit`)

### What the Test Does

1. **Takes Snapshot** - Captures the accessibility tree with `backendDOMNodeId` for each element
2. **Finds Element** - Locates the "Sign up" button and extracts its `backendDOMNodeId`
3. **Tests ARIA Approach** - Uses `get_react_component_from_snapshot` with role/name
4. **Tests CDP Approach** - Uses `get_react_component_from_backend_node_id` with backendDOMNodeId
5. **Compares Results** - Verifies both approaches return:
   - Same component name
   - Same component type
   - Same number of owner components
   - Same owner component names
   - Same source location

### Expected Output

When the test passes, you'll see output like:

```
✓ MCP server initialized
✓ Snapshot taken
✓ Found backendDOMNodeId: 42
✓ ARIA approach succeeded
  Component: MyButton (ForwardRef)
  Owners: 5 components
✓ CDP approach succeeded
  Component: MyButton (ForwardRef)
  Owners: 5 components
✓ Component name matches: MyButton
✓ Component type matches: ForwardRef
✓ Owners count matches: 5 owners
✓ Source location matches: src/components/MyButton.tsx:12:5

🎉 Integration test PASSED! Both approaches are equivalent.
```

## Manual Testing with JSONL

You can also test individual tools using JSONL (JSON Lines) format:

```bash
# Create a test file
cat > /tmp/test.jsonl << 'EOF'
{"jsonrpc":"2.0","id":"init","method":"initialize","params":{"protocolVersion":"2024-12-19","capabilities":{},"clientInfo":{"name":"cli","version":"0.0.0"}}}
{"jsonrpc":"2.0","id":"snapshot","method":"tools/call","params":{"name":"take_snapshot","arguments":{"verbose":true}}}
EOF

# Run the test (replace with your React app URL)
cat /tmp/test.jsonl | TARGET_URL=http://localhost:3000 node build/src/main.js --isolated --headless 2>&1 > /tmp/result.json

# View results
cat /tmp/result.json | tail -1 | jq
```

## Test Coverage

The integration test validates:
- ✅ Snapshot generation with `backendDOMNodeId`
- ✅ ARIA selector element lookup
- ✅ CDP backendDOMNodeId element lookup
- ✅ React fiber tree navigation
- ✅ Component metadata extraction (name, type, props, state, source, owners)
- ✅ Equivalence of both approaches
- ⏸️ Edge cases (pending - Issue #5)

## Continuous Testing

For development, you can run the test in watch mode:

```bash
# Terminal 1: Start your React dev server
cd /path/to/your/react/app
npm run dev

# Terminal 2: Configure and run test repeatedly
export TARGET_URL=http://localhost:3000
export TEST_ROLE=button
export TEST_NAME="Submit"
while true; do npm run test:example && sleep 5; done
```
