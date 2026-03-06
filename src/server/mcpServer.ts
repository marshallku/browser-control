import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTabTools } from "./tools/tabs.js";
import { registerDomTools } from "./tools/dom.js";
import { registerInteractionTools } from "./tools/interaction.js";
import { registerCaptureTools } from "./tools/capture.js";
import { registerExecutionTools } from "./tools/execution.js";

export function createMcpServer(): McpServer {
    const server = new McpServer({
        name: "browser-control",
        version: "0.1.0",
    });

    registerTabTools(server);
    registerDomTools(server);
    registerInteractionTools(server);
    registerCaptureTools(server);
    registerExecutionTools(server);

    return server;
}
