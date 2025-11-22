# Examples

This directory contains example code demonstrating how to use and test React DevTools MCP.

## integration-test.ts

An example integration test that compares the ARIA selector approach vs the CDP `backendDOMNodeId` approach for mapping UI elements to React components.

**Purpose**: Demonstrates how both approaches return equivalent component data (name, type, props, state, source, owners).

**Usage**:
```bash
# Customize for your React app
export TARGET_URL=http://localhost:3000
export TEST_ROLE=button
export TEST_NAME="Submit"

npm run test:example
```

See [../TESTING.md](../TESTING.md) for full documentation.

## Customization

These examples are templates you can copy and modify for your specific use case:

1. **Copy the example**: `cp examples/integration-test.ts my-test.ts`
2. **Modify the configuration** for your React app
3. **Run your custom test**: `npx tsx my-test.ts`

## Contributing

If you create useful examples, consider contributing them back to the project!
