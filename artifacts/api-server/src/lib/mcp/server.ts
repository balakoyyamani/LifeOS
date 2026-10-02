import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { LIFEOS_MCP_TOOLS } from "./tools-registry";
import { dispatchMcpTool } from "./tools-dispatcher";

export function createLifeOsMcpServer() {
  const server = new Server(
    {
      name: "LifeOS Personal Career & Life Operating System",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: LIFEOS_MCP_TOOLS,
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return await dispatchMcpTool(name, args);
  });

  return server;
}
