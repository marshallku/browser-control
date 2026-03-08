import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { send } from "../bridge.js";

export function registerDomTools(server: McpServer): void {
  server.tool(
    "get_html",
    "Get HTML content from a page or element",
    {
      tabId: z.number().optional().describe("Tab ID (default: active tab)"),
      selector: z
        .string()
        .optional()
        .describe("CSS selector (default: document.body)"),
      outer: z
        .boolean()
        .optional()
        .describe("Include outer HTML (default: true)"),
    },
    async ({ tabId, selector, outer }) => {
      const res = await send("dom.getHtml", { tabId, selector, outer });
      return {
        content: [
          { type: "text", text: res.success ? String(res.data) : res.error! },
        ],
        isError: !res.success,
      };
    },
  );

  server.tool(
    "get_text",
    "Get text content from a page or element",
    {
      tabId: z.number().optional().describe("Tab ID (default: active tab)"),
      selector: z
        .string()
        .optional()
        .describe("CSS selector (default: document.body)"),
    },
    async ({ tabId, selector }) => {
      const res = await send("dom.getText", { tabId, selector });
      return {
        content: [
          { type: "text", text: res.success ? String(res.data) : res.error! },
        ],
        isError: !res.success,
      };
    },
  );

  server.tool(
    "query_selector",
    "Find elements matching a CSS selector",
    {
      tabId: z.number().optional().describe("Tab ID (default: active tab)"),
      selector: z.string().describe("CSS selector"),
      limit: z.number().optional().describe("Max results (default: 20)"),
    },
    async ({ tabId, selector, limit }) => {
      const res = await send("dom.querySelector", { tabId, selector, limit });
      return {
        content: [
          {
            type: "text",
            text: res.success ? JSON.stringify(res.data, null, 2) : res.error!,
          },
        ],
        isError: !res.success,
      };
    },
  );
}
