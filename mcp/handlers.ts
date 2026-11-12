import {
    FIXTURE_FILES,
    TOOL_ERRORS,
    TOOL_MESSAGES,
    CALENDAR_KINDS,
    ISO_DATE_LENGTH,
    ISO_DATE_PATTERN,
    type CalendarKind,
} from "../constants.ts";
import { fixtureUrl, readJson } from "../stores/json-file.ts";
import { findShipmentForAgent } from "../stores/shipment-lookup.ts";

export function getShipmentHistory(shipmentId: string): unknown {
  const shipment = findShipmentForAgent(shipmentId);

  if (!shipment) {
    const notFound = {
      error: TOOL_ERRORS.SHIPMENT_NOT_FOUND,
      shipment_id: shipmentId,
      hint: TOOL_MESSAGES.SHIPMENT_NOT_FOUND_HINT,
    };

    return notFound;
  }

  return shipment;
}

export function checkCustomsCalendar(countryCode: string, date: string): unknown {
  const day = String(date ?? "").trim().slice(0, ISO_DATE_LENGTH);

  if (!ISO_DATE_PATTERN.test(day)) {
    const invalidDate = {
      error: TOOL_ERRORS.INVALID_DATE,
      received: date,
      hint: TOOL_MESSAGES.INVALID_DATE_HINT,
    };

    return invalidDate;
  }

  const code = String(countryCode ?? "").trim().toUpperCase();
  const entries = readJson<CalendarEntry[]>(fixtureUrl(FIXTURE_FILES.CUSTOMS_CALENDAR), []);
  const match = entries.find((entry) => entry.country_code === code && entry.start <= day && day <= entry.end);

  if (match) {
    const matched = {
      country_code: code,
      date: day,
      is_holiday: match.kind === CALENDAR_KINDS.HOLIDAY,
      known_delay_window: match.kind === CALENDAR_KINDS.DELAY_WINDOW,
      note: match.note,
    };

    return matched;
  }

  const normalDay = {
    country_code: code,
    date: day,
    is_holiday: false,
    known_delay_window: false,
    note: TOOL_MESSAGES.NORMAL_WORKING_DAY_NOTE,
  };

  return normalDay;
}

interface CalendarEntry {
  country_code: string;
  start: string;
  end: string;
  kind: CalendarKind;
  note: string;
}
