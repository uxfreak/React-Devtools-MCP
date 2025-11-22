# React Context MCP

[![npm version](https://img.shields.io/npm/v/react-context-mcp.svg)](https://npmjs.org/package/react-context-mcp)
[![License](https://img.shields.io/npm/l/react-context-mcp.svg)](https://github.com/uxfreak/react-context-mcp/blob/main/LICENSE)

`react-context-mcp` lets your AI coding assistant (Claude, Cursor, Copilot, Gemini) inspect and debug React applications in a live Chrome browser. It acts as a Model Context Protocol (MCP) server, providing access to React component trees, props, state, source locations, and full browser control for reliable debugging and development assistance.

## Key Features

### React DevTools Integration
- **Component Tree Inspection** - Browse React fiber tree with props, state, and source locations
- **Text-to-Component Mapping** - Find any visible text and trace it to the React component and source file
- **Two Element Mapping Methods**:
  - **CDP backendDOMNodeId** (Recommended) - Fast, deterministic element access via Chrome DevTools Protocol
  - **ARIA Selectors** (Legacy) - Cross-session element searching via accessibility tree
- **Component Highlighting** - Visual highlighting of components in the browser
- **Automatic Backend Injection** - React DevTools backend hook injected on page load

### Browser Page Management
- **Multi-page Support** - List, select, and switch between browser tabs
- **Page Navigation** - Navigate to URLs, go back/forward, reload pages
- **Page Control** - Create new pages, close tabs, manage browser sessions
- **Accessibility Snapshots** - Capture page structure with text content and DOM node IDs

## Requirements

- [Node.js](https://nodejs.org/) v20.19+ or v22.12+ or v23+
- [Chrome](https://www.google.com/chrome/) current stable version
- [npm](https://www.npmjs.com/)
- React application with development build (for source location tracking)

## Getting Started

### Quick Install

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "react-context": {
      "command": "npx",
      "args": ["-y", "react-context-mcp@latest"]
    }
  }
}
```

> [!NOTE]
> Using `@latest` ensures you always get the most recent version.

### MCP Client Setup

<details>
  <summary><b>Claude Code</b></summary>

Use the Claude Code CLI:

```bash
claude mcp add react-context npx react-context-mcp@latest
```

</details>

<details>
  <summary><b>Cursor</b></summary>

Go to `Cursor Settings` → `MCP` → `New MCP Server`, then add:

```json
{
  "mcpServers": {
    "react-context": {
      "command": "npx",
      "args": ["-y", "react-context-mcp@latest"]
    }
  }
}
```

</details>

<details>
  <summary><b>Cline / Windsurf / Other Clients</b></summary>

Add the configuration above to your MCP settings file. Refer to your client's documentation for the config file location.

</details>

### Connecting to Existing Browser

To connect to a Chrome instance with remote debugging enabled:

```bash
# Start Chrome with remote debugging
chrome --remote-debugging-port=9222

# Add to MCP config with browserUrl
claude mcp add react-context npx react-context-mcp@latest --browserUrl http://localhost:9222
```

### First Prompt

Try this in your MCP client:

```
Navigate to http://localhost:3000 and find the "Sign up" button.
Show me the React component and its source file.
```

Your AI assistant will open the browser, take a snapshot, find the button, and show you the complete component information with source location.

## MCP Tools

### Page Management Tools

#### `list_pages`
Get a list of all open browser pages/tabs.

**Example:**
```json
{"name": "list_pages", "arguments": {}}
```

**Response:**
```
## Pages
0: http://localhost:3000 [selected]
1: http://localhost:3001/admin
```

#### `select_page`
Select a page by index for future operations.

**Arguments:**
- `pageIdx` (number) - Page index from list_pages

**Example:**
```json
{"name": "select_page", "arguments": {"pageIdx": 1}}
```

#### `close_page`
Close a page by index. Cannot close the last open page.

**Arguments:**
- `pageIdx` (number) - Page index to close

#### `new_page`
Create a new page and navigate to a URL.

**Arguments:**
- `url` (string) - URL to load
- `timeout` (number, optional) - Navigation timeout in milliseconds

**Example:**
```json
{"name": "new_page", "arguments": {"url": "http://localhost:3000"}}
```

#### `navigate_page`
Navigate the currently selected page.

**Arguments:**
- `type` (string) - Navigation type: "url", "back", "forward", "reload"
- `url` (string, optional) - Target URL (required for type="url")
- `ignoreCache` (boolean, optional) - Ignore cache on reload
- `timeout` (number, optional) - Navigation timeout

**Example:**
```json
{"name": "navigate_page", "arguments": {"type": "url", "url": "http://localhost:3000/about"}}
```

### React DevTools Tools

#### `ensure_react_attached`
Inject React DevTools backend and detect renderers.

**Response:**
```
React DevTools backend is installed.
Renderers:
- id=1 name=react-dom version=18.3.0
```

#### `list_react_roots`
List all React roots on the current page.

**Arguments:**
- `rendererId` (number, optional) - Filter by renderer ID

**Response:**
```
renderer=1(react-dom) root=1:0 idx=0 name=App nodes=156
```

#### `list_components`
List React component tree with filtering.

**Arguments:**
- `rendererId` (number, optional) - Filter by renderer
- `rootIndex` (number, optional) - Filter by root
- `depth` (number, default: 3) - Traversal depth (1-10)
- `maxNodes` (number, default: 200) - Max nodes (1-2000)
- `nameFilter` (string, optional) - Substring match on name

**Example:**
```json
{"name": "list_components", "arguments": {"depth": 5, "maxNodes": 100}}
```

#### `get_component`
Get detailed component information by ID.

**Arguments:**
- `id` (string) - Component ID from list_components

**Response:**
```json
{
  "id": "1:0:0.2.1",
  "name": "Button",
  "type": "ForwardRef",
  "props": {"variant": "primary", "children": "Sign up"},
  "state": null,
  "source": {
    "fileName": "src/components/Button.tsx",
    "lineNumber": 42,
    "columnNumber": 8
  }
}
```

#### `highlight_component`
Visually highlight a component in the browser.

**Arguments:**
- `id` (string) - Component ID from list_components

#### `take_snapshot`
Capture accessibility tree snapshot with backendDOMNodeId for every element.

**Arguments:**
- `verbose` (boolean, default: false) - Include all elements or only interactive ones

**Response:**
```json
{
  "root": {
    "role": "RootWebArea",
    "name": "My App",
    "children": [
      {
        "role": "button",
        "name": "Sign up",
        "backendDOMNodeId": 48
      }
    ]
  }
}
```

#### `get_react_component_from_backend_node_id`
**Recommended:** Get React component using CDP backendDOMNodeId from snapshot.

**Arguments:**
- `backendDOMNodeId` (number) - From take_snapshot

**Why use this:**
- ✅ Faster and more deterministic than ARIA selectors
- ✅ Returns full component hierarchy from element to root
- ✅ Precise source locations for each component

**Example:**
```json
{"name": "get_react_component_from_backend_node_id", "arguments": {"backendDOMNodeId": 48}}
```

**Response:**
```json
{
  "success": true,
  "component": {
    "name": "Button",
    "type": "ForwardRef",
    "source": {
      "fileName": "src/components/Button.tsx",
      "lineNumber": 42
    },
    "props": {"variant": "primary", "children": "Sign up"},
    "owners": [
      {"name": "OnboardingScreen", "source": {...}},
      {"name": "App", "source": {...}}
    ]
  }
}
```

**Important:** backendDOMNodeId is only valid within the same browser session. Always use take_snapshot and this tool in the same MCP session.

#### `get_react_component_from_snapshot`
**Legacy:** Get React component using ARIA role and name.

**Arguments:**
- `role` (string) - Element role from snapshot
- `name` (string) - Element name/text from snapshot

**When to use:**
- Cross-session element tracking
- No backendDOMNodeId available

**Example:**
```json
{"name": "get_react_component_from_snapshot", "arguments": {"role": "button", "name": "Sign up"}}
```

## Common Workflows

### Finding Component Source from UI Text (Recommended Method)

Use CDP backendDOMNodeId for fastest, most reliable lookups:

```bash
# 1. Take snapshot (includes backendDOMNodeId for every element)
take_snapshot

# 2. Find your element in the snapshot JSON:
{
  "role": "button",
  "name": "Sign up",
  "backendDOMNodeId": 48  ← Use this
}

# 3. Get React component information
get_react_component_from_backend_node_id(48)
```

**Result:**
- ✅ Component name: Button (ForwardRef)
- ✅ Source: src/components/Button.tsx:42
- ✅ Props: {variant: "primary", children: "Sign up"}
- ✅ Owner chain: OnboardingScreen → App

### Managing Multiple Pages

```bash
# List all open pages
list_pages

# Create a new page
new_page("http://localhost:3001/admin")

# Switch between pages
select_page(1)

# Navigate current page
navigate_page(type="url", url="http://localhost:3001/settings")

# Close a page
close_page(1)
```

### Inspecting Component Tree

```bash
# 1. Ensure React is attached
ensure_react_attached

# 2. List roots
list_react_roots

# 3. Browse component tree
list_components(depth=5, maxNodes=200)

# 4. Get detailed component info
get_component("1:0:0.2.1")

# 5. Highlight component visually
highlight_component("1:0:0.2.1")
```

## Manual Installation

For development or local installation:

```bash
git clone https://github.com/uxfreak/react-context-mcp.git
cd react-context-mcp
npm install
npm run build

# Link globally
npm link

# Now use in MCP config
claude mcp add react-context react-context-mcp
```

## Command-Line Options

```bash
# Auto-navigate on startup
TARGET_URL=http://localhost:3000 react-context-mcp

# Connect to existing Chrome
react-context-mcp --browserUrl http://localhost:9222

# Isolated mode (separate Chrome profile)
react-context-mcp --isolated --headless

# Custom Chrome executable
react-context-mcp --executablePath /path/to/chrome

# Set viewport size
react-context-mcp --viewport 1920x1080
```

**Available flags:**
- `--headless` - Run Chrome in headless mode
- `--isolated` - Use isolated user data directory
- `--browserUrl <url>` - Connect to existing Chrome debugging session
- `--wsEndpoint <url>` - WebSocket endpoint for CDP
- `--executablePath <path>` - Path to Chrome executable
- `--channel <channel>` - Chrome channel (stable, canary, beta, dev)
- `--viewport <WxH>` - Viewport size (e.g., 1280x720)

## Source Location Tracking

For accurate source locations, your React app needs `data-inspector-*` attributes from Babel:

### Vite
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['@babel/plugin-transform-react-jsx-development']
      }
    })
  ]
})
```

### Next.js / Create React App
Automatically included in development mode. No configuration needed.

### Manual Babel
```json
{
  "env": {
    "development": {
      "plugins": ["@babel/plugin-transform-react-jsx-development"]
    }
  }
}
```

**Note:** Source tracking only works in development builds.

## Architecture

### React Backend Injection
1. Injects custom `__REACT_DEVTOOLS_GLOBAL_HOOK__` on page load
2. Intercepts `renderer.inject()` when React initializes
3. Captures fiber roots via `onCommitFiberRoot` hook
4. Stores fiber tree for inspection

### Component Tree Traversal
- Walks React fiber tree depth-first
- Starts from `root.current` fiber node
- Traverses via `fiber.child` and `fiber.sibling` pointers
- Generates stable path-based IDs

### Two Element-to-Component Mapping Methods

#### Method 1: CDP backendDOMNodeId (Recommended)
1. Get backendDOMNodeId from snapshot
2. Use `DOM.resolveNode({backendNodeId})` to get element reference
3. Execute `element.__reactFiber$...` in element context
4. Walk fiber tree to collect component hierarchy
5. Return complete chain with source locations

**Benefits:**
- ✅ Faster (direct access)
- ✅ More deterministic (unique numeric ID)
- ✅ Full component hierarchy
- ✅ Precise source locations

#### Method 2: ARIA Selectors (Legacy)
1. Use `aria/Name[role="button"]` selector
2. Find element via accessibility tree
3. Extract React fiber from element
4. Return component information

**Benefits:**
- ✅ Cross-session compatible
- ✅ No staleness issues
- ✅ Works with dynamic content

## Troubleshooting

### Browser Already Running
Use `--isolated` flag:
```bash
react-context-mcp --isolated
```

### No React Renderers Detected
- Ensure React is loaded on the page
- Try refreshing after backend injection
- Check browser console for errors

### Missing Source Locations
- Requires development build
- Add Babel plugin (see Source Location Tracking)
- Production builds strip this metadata

### backendDOMNodeId Not Found
- Only valid in same browser session
- Use take_snapshot and get_react_component_from_backend_node_id in same MCP session
- For cross-session tracking, use ARIA selectors instead

## License

Apache-2.0

## Links

- **npm Package:** https://www.npmjs.com/package/react-context-mcp
- **GitHub Repository:** https://github.com/uxfreak/react-context-mcp
- **Issues:** https://github.com/uxfreak/react-context-mcp/issues
- **Model Context Protocol:** https://modelcontextprotocol.io
