import { tool } from "langchain";
import { z } from "zod";
import { readFileSync } from "node:fs";
import {
    TOOL_NAMES,
    TOOL_DESCRIPTIONS,
    FIXTURE_FILES,
    TOOL_ERRORS,
    TOOL_MESSAGES,
    CALENDAR_KINDS,
    ISO_DATE_LENGTH,
    ISO_DATE_PATTERN,
    type CalendarKind,
} from "./constants.ts";

const FIXTURES = new URL("./fixtures/", import.meta.url);

export const getShipmentHistoryTool = tool(
    async ({ shipment_id }) => JSON.stringify(getShipmentHistory(shipment_id)),
    {
        name: TOOL_NAMES.GET_SHIPMENT_HISTORY,
        description: TOOL_DESCRIPTIONS.GET_SHIPMENT_HISTORY,
        schema: z.object({
            shipment_id: z.string().describe("Shipment ID, e.g. 'SH-1001'"),
        }),
    },
);

export const checkCustomsCalendarTool = tool(
    async ({ country_code, date }) => JSON.stringify(checkCustomsCalendar(country_code, date)),
    {
        name: TOOL_NAMES.CHECK_CUSTOMS_CALENDAR,
        description: TOOL_DESCRIPTIONS.CHECK_CUSTOMS_CALENDAR,
        schema: z.object({
            country_code: z.string().describe("Two-letter ISO country code, e.g. 'AE', 'DE', 'PK'"),
            date: z.string().describe("ISO 8601 date, YYYY-MM-DD"),
        }),
    },
);


export function getShipmentHistory(shipment_id: string): unknown {
  const data = readFixture<Record<string, unknown>>(FIXTURE_FILES.SHIPMENTS);
  const id = String(shipment_id ?? "").trim().toUpperCase();
  const shipment = data[id];
  
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
  const entries = readFixture<CalendarEntry[]>(FIXTURE_FILES.CUSTOMS_CALENDAR);

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

function readFixture<T>(fileName: string): T {
  return JSON.parse(readFileSync(new URL(fileName, FIXTURES), "utf-8")) as T;
}

interface CalendarEntry {
  country_code: string;
  start: string;
  end: string;
  kind: CalendarKind;
  note: string;
}
