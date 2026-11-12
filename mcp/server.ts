import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
    MCP_SERVER_NAME,
    MCP_SERVER_VERSION,
    TOOL_DESCRIPTIONS,
    TOOL_NAMES,
} from "../constants.ts";
import { checkCustomsCalendar, getShipmentHistory } from "./handlers.ts";

const SHIPMENT_HISTORY_INPUT = z.object({
    shipment_id: z.string().describe("Shipment ID, e.g. 'SH-1001'"),
});

const CUSTOMS_CALENDAR_INPUT = z.object({
    country_code: z.string().describe("Two-letter ISO country code, e.g. 'AE', 'DE', 'PK'"),
    date: z.string().describe("ISO 8601 date, YYYY-MM-DD"),
});

export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION });

  server.registerTool(
    TOOL_NAMES.GET_SHIPMENT_HISTORY,
    {
      description: TOOL_DESCRIPTIONS.GET_SHIPMENT_HISTORY,
      inputSchema: SHIPMENT_HISTORY_INPUT,
    },
    async ({ shipment_id }) => {
      const history = getShipmentHistory(shipment_id);
      const toolResult = toTextResult(history);

      return toolResult;
    },
  );

  server.registerTool(
    TOOL_NAMES.CHECK_CUSTOMS_CALENDAR,
    {
      description: TOOL_DESCRIPTIONS.CHECK_CUSTOMS_CALENDAR,
      inputSchema: CUSTOMS_CALENDAR_INPUT,
    },
    async ({ country_code, date }) => {
      const calendar = checkCustomsCalendar(country_code, date);
      const toolResult = toTextResult(calendar);

      return toolResult;
    },
  );

  return server;
}

function toTextResult(value: unknown) {
  const result = { content: [{ type: "text" as const, text: JSON.stringify(value) }] };

  return result;
}
