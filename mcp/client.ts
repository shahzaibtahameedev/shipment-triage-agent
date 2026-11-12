import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import {
    DEFAULT_MCP_URL,
    MCP_SERVER_NAME,
    MCP_SERVER_VERSION,
    TOOL_ERRORS,
    TOOL_MESSAGES,
} from "../constants.ts";

const MCP_URL = process.env.MCP_URL ?? DEFAULT_MCP_URL;
const CLIENT_NAME = `${MCP_SERVER_NAME}-agent-client`;
const TEXT_CONTENT_TYPE = "text";

let clientPromise: Promise<Client> | undefined;

export async function callMcpTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    const client = await getClient();
    const result = await client.callTool({ name, arguments: args });

    if (result.isError) {
      const toolError = { error: TOOL_ERRORS.MCP_TOOL_FAILED, detail: readText(result.content) };

      return toolError;
    }

    const parsed = parseToolResult(result.content);

    return parsed;
  } catch (error) {
    console.error(`MCP tool call failed: ${name}`, error);
    const unavailable = {
      error: TOOL_ERRORS.MCP_UNAVAILABLE,
      hint: TOOL_MESSAGES.MCP_UNAVAILABLE_HINT,
    };

    return unavailable;
  }
}

export async function closeMcpClient(): Promise<void> {
  if (!clientPromise) {
    return;
  }

  const pending = clientPromise;
  clientPromise = undefined;

  try {
    const client = await pending;
    await client.close();
  } catch (error) {
    console.error("MCP client close failed", error);
  }
}

async function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = connect();
  }

  try {
    const client = await clientPromise;

    return client;
  } catch (error) {
    clientPromise = undefined;

    throw error;
  }
}

async function connect(): Promise<Client> {
  const client = new Client({ name: CLIENT_NAME, version: MCP_SERVER_VERSION });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  await client.connect(transport);

  return client;
}

function parseToolResult(content: unknown): unknown {
  const text = readText(content);

  if (text === undefined) {
    throw new Error("MCP tool result had no text content");
  }

  const parsed = JSON.parse(text) as unknown;

  return parsed;
}

function readText(content: unknown): string | undefined {
  if (!Array.isArray(content)) {
    return undefined;
  }

  const textBlock = content.find((block) => block?.type === TEXT_CONTENT_TYPE);

  if (!textBlock || typeof textBlock.text !== "string") {
    return undefined;
  }

  return textBlock.text;
}
