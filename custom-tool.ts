import { tool } from "langchain";
import { z } from "zod";
import {
    TOOL_NAMES,
    FIXTURE_FILES,
    TOOL_ERRORS,
    TOOL_MESSAGES,
    CALENDAR_KINDS,
    ISO_DATE_LENGTH,
    ISO_DATE_PATTERN,
    type CalendarKind,
} from "./constants.ts";
import { log, LOG_EVENTS } from "./logger.ts";
import { redact } from "./tracing.ts";
import { fixtureUrl, readJson } from "./stores/json-file.ts";
import { findShipmentForAgent } from "./stores/shipment-lookup.ts";

export const evalHooks = {
    calls: [] as { name: string; args: Record<string, unknown> }[],
    carrierNote: "",
};

export function createShipmentHistoryTool(description: string) {
    const shipmentHistoryTool = tool(
        async ({ shipment_id }) => {
            const args = { shipment_id };
            evalHooks.calls.push({ name: TOOL_NAMES.GET_SHIPMENT_HISTORY, args });
            const history = getShipmentHistory(shipment_id);
            const note = evalHooks.carrierNote;
            const toolResult = note ? Object.assign({}, history, { carrier_notes: note }) : history;
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
            const toolResult = checkCustomsCalendar(country_code, date);
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

// Same PII redaction as the Langfuse traces: logs are shown in the UI
function logToolCall(name: string, args: Record<string, unknown>, result: unknown): void {
  log({
    event: LOG_EVENTS.TOOL_CALL,
    message: `${name}(${JSON.stringify(args)})`,
    data: { tool: name, args, result: redact(result) },
  });
}

export function getShipmentHistory(shipment_id: string): unknown {
  const shipment = findShipmentForAgent(shipment_id);

  if (!shipment) {
    return {
      error: TOOL_ERRORS.SHIPMENT_NOT_FOUND,
      shipment_id: shipment_id,
      hint: TOOL_MESSAGES.SHIPMENT_NOT_FOUND_HINT,
    };
  }

  return shipment;
}


function checkCustomsCalendar(country_code: string, date: string ): unknown {
  const day = String(date ?? "").trim().slice(0, ISO_DATE_LENGTH);
  if (!ISO_DATE_PATTERN.test(day)) {
    return {
      error: TOOL_ERRORS.INVALID_DATE,
      received: date,
      hint: TOOL_MESSAGES.INVALID_DATE_HINT,
    };
  }

  const code = String(country_code ?? "").trim().toUpperCase();
  const entries = readJson<CalendarEntry[]>(fixtureUrl(FIXTURE_FILES.CUSTOMS_CALENDAR), []);

  const match = entries.find((e) => e.country_code === code && e.start <= day && day <= e.end);

  if (match) {
    return {
      country_code: code,
      date: day,
      is_holiday: match.kind === CALENDAR_KINDS.HOLIDAY,
      known_delay_window: match.kind === CALENDAR_KINDS.DELAY_WINDOW,
      note: match.note,
    };
  }

  return {
    country_code: code,
    date: day,
    is_holiday: false,
    known_delay_window: false,
    note: TOOL_MESSAGES.NORMAL_WORKING_DAY_NOTE,
  };
}

interface CalendarEntry {
  country_code: string;
  start: string;
  end: string;
  kind: CalendarKind;
  note: string;
}
