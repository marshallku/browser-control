import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { send } from "../bridge.js";

export function registerInteractionTools(server: McpServer): void {
    server.tool(
        "click_element",
        "Click an element on the page",
        {
            tabId: z.number().optional().describe("Tab ID (default: active tab)"),
            selector: z.string().describe("CSS selector of element to click"),
        },
        async ({ tabId, selector }) => {
            const res = await send("interaction.click", { tabId, selector });
            return {
                content: [{ type: "text", text: res.success ? "Clicked" : res.error! }],
                isError: !res.success,
            };
        },
    );

    server.tool(
        "type_text",
        "Type text into an input element",
        {
            tabId: z.number().optional().describe("Tab ID (default: active tab)"),
            selector: z.string().describe("CSS selector of input element"),
            text: z.string().describe("Text to type"),
            clear: z.boolean().optional().describe("Clear existing value first (default: true)"),
        },
        async ({ tabId, selector, text, clear }) => {
            const res = await send("interaction.type", { tabId, selector, text, clear });
            return {
                content: [{ type: "text", text: res.success ? "Typed" : res.error! }],
                isError: !res.success,
            };
        },
    );

    server.tool(
        "scroll",
        "Scroll the page or an element",
        {
            tabId: z.number().optional().describe("Tab ID (default: active tab)"),
            x: z.number().optional().describe("Horizontal scroll amount in pixels"),
            y: z.number().optional().describe("Vertical scroll amount in pixels"),
            selector: z.string().optional().describe("CSS selector to scroll into view"),
        },
        async ({ tabId, x, y, selector }) => {
            const res = await send("interaction.scroll", { tabId, x, y, selector });
            return {
                content: [{ type: "text", text: res.success ? "Scrolled" : res.error! }],
                isError: !res.success,
            };
        },
    );

    server.tool(
        "press_key",
        "Press a keyboard key",
        {
            tabId: z.number().optional().describe("Tab ID (default: active tab)"),
            key: z.string().describe("Key to press (e.g. 'Enter', 'Tab', 'Escape', 'a')"),
            selector: z.string().optional().describe("CSS selector of target element"),
        },
        async ({ tabId, key, selector }) => {
            const res = await send("interaction.pressKey", { tabId, key, selector });
            return {
                content: [{ type: "text", text: res.success ? "Key pressed" : res.error! }],
                isError: !res.success,
            };
        },
    );
}
