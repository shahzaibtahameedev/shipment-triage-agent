import { serve } from "@hono/node-server";
import { Hono } from "hono";
import {
    createMcpHandler,
    hostHeaderValidationResponse,
    localhostAllowedHostnames,
    localhostAllowedOrigins,
    originValidationResponse,
} from "@modelcontextprotocol/server";
import { DEFAULT_MCP_HOST, DEFAULT_MCP_PORT, MCP_PATH } from "../constants.ts";
import { buildMcpServer } from "./server.ts";

const PORT = Number(process.env.MCP_PORT ?? DEFAULT_MCP_PORT);
const HOST = process.env.MCP_HOST ?? DEFAULT_MCP_HOST;

const handler = createMcpHandler(buildMcpServer, { onerror: (error) => console.error(error) });

const app = new Hono();

app.all(MCP_PATH, async (c) => {
  const rejected =
    hostHeaderValidationResponse(c.req.raw, localhostAllowedHostnames()) ??
    originValidationResponse(c.req.raw, localhostAllowedOrigins());

  if (rejected) {
    return rejected;
  }

  const response = await handler.fetch(c.req.raw);

  return response;
});

const server = serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
  console.log(`MCP listening on http://${HOST}:${info.port}${MCP_PATH}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await handler.close();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
