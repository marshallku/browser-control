import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { send } from "../bridge.js";

export function registerCredentialTools(server: McpServer): void {
  server.tool(
    "list_credentials",
    "List saved credential aliases. Credentials are managed in the browser extension options page — no actual usernames or passwords are ever exposed here.",
    {
      masterPassword: z
        .string()
        .describe("Master password to decrypt the credential store"),
    },
    async ({ masterPassword }) => {
      const res = await send("credentials.list", { masterPassword });
      if (!res.success) {
        return {
          content: [{ type: "text", text: res.error! }],
          isError: true,
        };
      }
      const aliases = res.data as string[];
      if (aliases.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No credentials saved. Add them via the extension options page.",
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Saved credentials:\n${aliases.map((a) => `  - ${a}`).join("\n")}`,
          },
        ],
      };
    },
  );

  server.tool(
    "fill_credential",
    "Fill a login form using a saved credential. The actual username/password are NEVER exposed — they are decrypted inside the browser extension and typed directly into the form fields with human-like behavior. Credentials must be added beforehand via the extension options page.",
    {
      masterPassword: z
        .string()
        .describe("Master password to decrypt the credential store"),
      alias: z
        .string()
        .describe("Alias of the credential to use (e.g. 'github')"),
      usernameSelector: z
        .string()
        .describe("CSS selector for the username/email input field"),
      passwordSelector: z
        .string()
        .describe("CSS selector for the password input field"),
      tabId: z.number().optional().describe("Tab ID (default: active tab)"),
      submit: z
        .boolean()
        .optional()
        .describe(
          "Whether to click the submit button after filling (default: false)",
        ),
      submitSelector: z
        .string()
        .optional()
        .describe(
          "CSS selector for the submit button (required if submit is true)",
        ),
    },
    async ({
      masterPassword,
      alias,
      usernameSelector,
      passwordSelector,
      tabId,
      submit,
      submitSelector,
    }) => {
      const res = await send("credentials.fill", {
        masterPassword,
        alias,
        usernameSelector,
        passwordSelector,
        tabId,
        submit,
        submitSelector,
      });

      if (!res.success) {
        return {
          content: [{ type: "text", text: res.error! }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Login form filled using credential '${alias}'.${submit ? " Form submitted." : ""}`,
          },
        ],
      };
    },
  );
}
