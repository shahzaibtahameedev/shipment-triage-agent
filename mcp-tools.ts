import { tool } from "langchain";
import { z } from "zod";
import { TOOL_NAMES } from "./constants.ts";
import { log, LOG_EVENTS } from "./logger.ts";
import { redact } from "./tracing.ts";
import { callMcpTool } from "./mcp/client.ts";

export const evalHooks = {
    calls: [] as { name: string; args: Record<string, unknown> }[],
    carrierNote: "",
};

export function createShipmentHistoryTool(description: string) {
    const shipmentHistoryTool = tool(
        async ({ shipment_id }) => {
            const args = { shipment_id };
            evalHooks.calls.push({ name: TOOL_NAMES.GET_SHIPMENT_HISTORY, args });
            const history = await callMcpTool(TOOL_NAMES.GET_SHIPMENT_HISTORY, args);
            const toolResult = withCarrierNote(history);
            logToolCall(TOOL_NAMES.GET_SHIPMENT_HISTORY, args, toolResult);
            const serialized = JSON.stringify(toolResult);

            return serialized;
        },
        {
            name: TOOL_NAMES.GET_SHIPMENT_HISTORY,
            description,
            schema: z.object({
                shipment_id: z.string().describe("Shipment ID, e.g. 'SH-1001'"),
            }),
        },
    );

    return shipmentHistoryTool;
}

export function createCustomsCalendarTool(description: string) {
    const customsCalendarTool = tool(
        async ({ country_code, date }) => {
            const args = { country_code, date };
            evalHooks.calls.push({ name: TOOL_NAMES.CHECK_CUSTOMS_CALENDAR, args });
            const toolResult = await callMcpTool(TOOL_NAMES.CHECK_CUSTOMS_CALENDAR, args);
            logToolCall(TOOL_NAMES.CHECK_CUSTOMS_CALENDAR, args, toolResult);
            const serialized = JSON.stringify(toolResult);

            return serialized;
        },
        {
            name: TOOL_NAMES.CHECK_CUSTOMS_CALENDAR,
            description,
            schema: z.object({
                country_code: z.string().describe("Two-letter ISO country code, e.g. 'AE', 'DE', 'PK'"),
                date: z.string().describe("ISO 8601 date, YYYY-MM-DD"),
            }),
        },
    );

    return customsCalendarTool;
}

// Red-team injection point: applied to the response, so the MCP server stays free of eval state
function withCarrierNote(history: unknown): unknown {
  const note = evalHooks.carrierNote;

  if (!note) {
    return history;
  }

  const injected = Object.assign({}, history, { carrier_notes: note });

  return injected;
}

// Same PII redaction as the Langfuse traces: logs are shown in the UI
function logToolCall(name: string, args: Record<string, unknown>, result: unknown): void {
  log({
    event: LOG_EVENTS.TOOL_CALL,
    message: `${name}(${JSON.stringify(args)})`,
    data: { tool: name, args, result: redact(result) },
  });
}
