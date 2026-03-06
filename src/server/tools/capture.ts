import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { send } from "../bridge.js";

export function registerCaptureTools(server: McpServer): void {
    server.tool(
        "screenshot",
        "Capture a screenshot of the visible area of a tab",
        {
            tabId: z.number().optional().describe("Tab ID (default: active tab)"),
        },
        async ({ tabId }) => {
            const res = await send("capture.screenshot", { tabId });
            if (!res.success) {
                return { content: [{ type: "text", text: res.error! }], isError: true };
            }
            const dataUrl = String(res.data);
            const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
            return {
                content: [{ type: "image", data: base64, mimeType: "image/png" }],
            };
        },
    );

    server.tool(
        "get_computed_styles",
        "Get computed CSS styles for an element",
        {
            tabId: z.number().optional().describe("Tab ID (default: active tab)"),
            selector: z.string().describe("CSS selector of the element"),
            properties: z.array(z.string()).optional().describe("Specific CSS properties to get (default: all)"),
        },
        async ({ tabId, selector, properties }) => {
            const res = await send("capture.computedStyles", { tabId, selector, properties });
            return {
                content: [{ type: "text", text: res.success ? JSON.stringify(res.data, null, 2) : res.error! }],
                isError: !res.success,
            };
        },
    );
}
