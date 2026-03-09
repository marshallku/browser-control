# Browser Control

An MCP (Model Context Protocol) server that lets AI assistants control a web browser through a Firefox WebExtension bridge. The server communicates with the extension over WebSocket, exposing browser actions as MCP tools that any compatible AI client can call.

## Architecture

```
AI Client (e.g. Claude) ←—stdio—→ MCP Server ←—WebSocket—→ Browser Extension
```

- **MCP Server** — Node.js process that exposes tools over stdio and relays commands through a WebSocket bridge.
- **Browser Extension** — Firefox extension that receives commands, executes them via browser APIs and content scripts, and returns results.

## Available Tools

| Category        | Tool                  | Description                                                                    |
| --------------- | --------------------- | ------------------------------------------------------------------------------ |
| **Tabs**        | `list_tabs`           | List all open browser tabs                                                     |
|                 | `open_tab`            | Open a new tab                                                                 |
|                 | `close_tab`           | Close a tab by ID                                                              |
|                 | `navigate`            | Navigate a tab to a URL                                                        |
|                 | `activate_tab`        | Focus a tab by ID                                                              |
| **DOM**         | `get_html`            | Get HTML content from a page or element                                        |
|                 | `get_text`            | Get text content from a page or element                                        |
|                 | `query_selector`      | Find elements matching a CSS selector                                          |
| **Interaction** | `click_element`       | Click an element                                                               |
|                 | `type_text`           | Type text into an input field                                                  |
|                 | `hover_element`       | Hover over an element (human-like mouse movement)                              |
|                 | `scroll`              | Scroll the page or an element                                                  |
|                 | `press_key`           | Press a keyboard key                                                           |
| **Capture**     | `screenshot`          | Capture a screenshot of the visible area                                       |
|                 | `get_computed_styles` | Get computed CSS styles for an element                                         |
| **Execution**   | `execute_js`          | Execute JavaScript in a tab                                                    |
| **Credentials** | `list_credentials`    | List saved credential aliases                                                  |
|                 | `fill_credential`     | Fill a login form using a saved credential (secrets never leave the extension) |

## Prerequisites

- Node.js >= 18
- A supported browser: Brave, Chrome, Edge (Manifest V3) or Firefox (Manifest V2)
- npm

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd browser-control

# Install dependencies
npm install

# Build the server
npm run build
```

### Load the Browser Extension

**Chromium (Brave / Chrome / Edge):**

1. Navigate to `chrome://extensions/` (or `brave://extensions/`).
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select the `src/extension/chromium` directory.
4. The extension icon should appear in the toolbar.

**Firefox:**

1. Navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select the file `src/extension/firefox/manifest.json`.
4. The extension icon should appear in the toolbar.

### Configure your MCP Client

Using Claude Code CLI:

```bash
claude mcp add browser-control -- node dist/server/index.js
```

Or manually add to your MCP client config (e.g. Claude Desktop's `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "browser-control": {
      "command": "node",
      "args": ["dist/server/index.js"],
      "cwd": "/path/to/browser-control"
    }
  }
}
```

## Usage

1. Start the MCP server (your AI client does this automatically via the config above, or manually):
   ```bash
   npm start        # production (requires build)
   npm run dev      # development (tsx, no build needed)
   ```
2. Make sure the browser extension is loaded and connected — you should see "Extension connected" in the server logs.
3. The AI client can now call any of the available tools to interact with the browser.

## Configuration

| Environment Variable   | Default | Description                          |
| ---------------------- | ------- | ------------------------------------ |
| `BROWSER_CONTROL_PORT` | `7865`  | WebSocket port the server listens on |

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Build TypeScript
npm run build
```

## License

ISC
