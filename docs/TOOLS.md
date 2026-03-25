# Browser Control MCP Tools

44 MCP tools organized by category. All tools accept an optional `tabId` parameter (defaults to active tab) unless noted.

---

## Tab Management (8 tools)

| Tool           | Description                 | Key Params         |
| -------------- | --------------------------- | ------------------ |
| `list_tabs`    | List all open browser tabs  | —                  |
| `open_tab`     | Open a new tab              | `url`              |
| `close_tab`    | Close a tab                 | `tabId` (required) |
| `navigate`     | Navigate tab to URL         | `url`, `tabId?`    |
| `activate_tab` | Focus a tab                 | `tabId` (required) |
| `go_back`      | Navigate back in history    | `tabId?`           |
| `go_forward`   | Navigate forward in history | `tabId?`           |
| `reload`       | Reload the tab              | `tabId?`           |

## DOM Tools (4 tools)

| Tool                     | Description                                | Key Params                           |
| ------------------------ | ------------------------------------------ | ------------------------------------ |
| `get_html`               | Get HTML content (cleaned by default)      | `selector?`, `outer?`, `clean?`      |
| `get_text`               | Get visible text content                   | `selector?`, `raw?`, `mainContent?`  |
| `query_selector`         | Find elements by CSS selector              | `selector`, `limit?`, `visibleOnly?` |
| `get_accessibility_tree` | Semantic page tree with roles, names, refs | `maxElements?` (default: 500)        |
| `get_form_values`        | Get all named input values from a form     | `selector`                           |

## Interaction Tools (8 tools)

| Tool               | Description                     | Key Params                             |
| ------------------ | ------------------------------- | -------------------------------------- |
| `click_element`    | Click by CSS selector           | `selector`                             |
| `type_text`        | Type into input                 | `selector`, `text`, `clear?`           |
| `scroll`           | Scroll page or element          | `selector?`, `x?`, `y?`                |
| `press_key`        | Press keyboard key              | `key`, `selector?`                     |
| `select_option`    | Select dropdown option          | `selector`, `value?`/`label?`/`index?` |
| `check_element`    | Check/uncheck checkbox or radio | `selector`, `checked?`                 |
| `click_annotation` | Click by annotation ref number  | `ref`                                  |
| `type_annotation`  | Type into element by ref number | `ref`, `text`, `clear?`                |

## Wait Tools (3 tools)

| Tool                    | Description                 | Key Params                               |
| ----------------------- | --------------------------- | ---------------------------------------- |
| `wait_for_selector`     | Wait for element to appear  | `selector`, `timeout?` (10s), `visible?` |
| `wait_for_navigation`   | Wait for page load complete | `timeout?` (30s)                         |
| `wait_for_network_idle` | Wait for network to settle  | `timeout?` (10s), `idleTime?` (500ms)    |

## Capture Tools (6 tools)

| Tool                  | Description                                  | Key Params                        |
| --------------------- | -------------------------------------------- | --------------------------------- |
| `screenshot`          | Screenshot visible area                      | —                                 |
| `screenshot_element`  | Screenshot specific element (cropped)        | `selector`                        |
| `screenshot_diff`     | Pixel diff two screenshots                   | `image1`, `image2`, `threshold?`  |
| `annotate_page`       | Number all interactive elements + screenshot | —                                 |
| `highlight_element`   | Temporary visual highlight                   | `selector`, `color?`, `duration?` |
| `get_computed_styles` | Get CSS computed styles                      | `selector`, `properties?`         |
| `get_page_metrics`    | Page performance & DOM metrics               | —                                 |

## Cookie & Storage Tools (8 tools)

| Tool              | Description                     | Key Params                                                         |
| ----------------- | ------------------------------- | ------------------------------------------------------------------ |
| `get_cookies`     | Get cookies for URL             | `url`                                                              |
| `set_cookie`      | Set a cookie                    | `url`, `name`, `value`, `domain?`, `path?`, `secure?`, `httpOnly?` |
| `delete_cookie`   | Delete a cookie                 | `url`, `name`                                                      |
| `get_storage`     | Get localStorage/sessionStorage | `type` (local/session), `key?`                                     |
| `set_storage`     | Set storage value               | `type`, `key`, `value`                                             |
| `clear_storage`   | Clear all storage               | `type`                                                             |
| `save_session`    | Save cookies + storage as JSON  | `url`                                                              |
| `restore_session` | Restore saved session           | `sessionData` (JSON)                                               |

## Dialog Tools (2 tools)

| Tool                  | Description                             | Key Params                         |
| --------------------- | --------------------------------------- | ---------------------------------- |
| `set_dialog_behavior` | Configure alert/confirm/prompt handling | `action` (accept/dismiss), `text?` |
| `get_last_dialog`     | Get last dialog info                    | —                                  |

## Monitor Tools (3 tools)

| Tool               | Description                                  | Key Params                              |
| ------------------ | -------------------------------------------- | --------------------------------------- |
| `get_console_logs` | Get captured console messages                | `level?` (all/log/warn/error), `limit?` |
| `get_page_errors`  | Get JS errors & unhandled rejections         | `limit?`                                |
| `get_page_metrics` | Navigation timing, resource counts, DOM size | —                                       |

## Execution (1 tool)

| Tool         | Description                        | Key Params |
| ------------ | ---------------------------------- | ---------- |
| `execute_js` | Execute JavaScript in page context | `code`     |

---

## Common Workflows

### Navigate and wait for content

```
navigate(url) -> wait_for_navigation() -> wait_for_selector(".content")
```

### Fill and submit a form

```
type_text(selector, text) -> select_option(selector, value) -> check_element(selector) -> click_element("button[type=submit]") -> wait_for_navigation()
```

### Semantic page understanding

```
get_accessibility_tree() -> click_annotation(ref) or type_annotation(ref, text)
```

### Visual annotation workflow

```
annotate_page() -> (view screenshot with numbered elements) -> click_annotation(3)
```

### Session persistence

```
save_session(url) -> (store JSON) -> restore_session(sessionData) -> reload()
```

### Debug a page

```
get_console_logs(level: "error") -> get_page_errors() -> get_page_metrics()
```
