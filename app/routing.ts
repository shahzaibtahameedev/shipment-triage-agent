import { HumanMessage } from "langchain";
import type { Span } from "@opentelemetry/api";
import { createModel, MODEL_BACKUP, MODEL_SMALL, MODEL_STRONG } from "./client.ts";
import {
  CLASSIFIER_ROUTES,
  EVENT_CODES,
  ISO_DATE_LENGTH,
  NODES,
  TRIAGE_ACTIONS,
  type ClassifierRoute,
  type TriageResult,
} from "./constants.ts";
import { checkCustomsCalendar } from "./tools/handlers.ts";
import type { ClassifierDecision, TriageStateType } from "./graph/state.ts";
import { log, LOG_EVENTS, LOG_LEVELS } from "../observability/logger.ts";
import { withNodeSpan, TRACE_ATTRIBUTES } from "../observability/tracing.ts";

const PING_MAX_TOKENS = 1;
const PING_TIMEOUT_MS = 4000;
const PING_MESSAGE = "ping";
const PING_ERROR_PREVIEW_LENGTH = 160;

const NO_MODEL = "";
const NO_MODEL_LABEL = "none";

const DETERMINISTIC_CONFIDENCE = 1;

const DATE_IN_TEXT_PATTERN = /\d{4}-\d{2}-\d{2}/;
const TIME_IN_TEXT_PATTERN = /\b\d{1,2}:\d{2}\b/;

const SHIPMENT_FIELDS = {
  SCANS: "scans",
  DESTINATION_COUNTRY_CODE: "destination_country_code",
  CARRIER_NOTES: "carrier_notes",
} as const;

const NOTE_SEPARATOR = " ";

export type ClassifyTarget = typeof NODES.ROUTE | typeof NODES.HUMAN_APPROVAL;

type ShipmentPayload = Record<string, unknown> | undefined;

interface ScanRecord {
  code?: string;
  note?: string;
  timestamp?: string;
}

interface CustomsCalendarCheck {
  is_holiday: boolean;
  known_delay_window: boolean;
  note: string;
}

interface DeterministicOutcome {
  result: TriageResult;
  reason: string;
}

interface ModelRoute {
  route: ClassifierRoute;
  model: string;
  reason: string;
}

interface ModelHealth {
  model: string;
  fallback_used: boolean;
}

export async function classifyNode(state: TriageStateType): Promise<Partial<TriageStateType>> {
  const stateUpdate = await withNodeSpan(NODES.CLASSIFY, async (span) => {
    const shipmentId = state.event.shipment_id ?? "";
    const payload = state.event.raw_payload;
    const latestScan = readLatestScan(payload) ?? {};
    const deterministic = findDeterministicOutcome(payload, latestScan);

    if (deterministic) {
      const deterministicDecision: ClassifierDecision = {
        route: CLASSIFIER_ROUTES.DETERMINISTIC,
        model: NO_MODEL,
        reason: deterministic.reason,
        fallback_used: false,
      };
      recordDecision(span, deterministicDecision, shipmentId);

      return { classifier_decision: deterministicDecision, triage_result: deterministic.result };
    }

    const modelRoute = decideModelRoute(payload, latestScan);
    const health = await resolveModel(modelRoute.model);
    const modelDecision: ClassifierDecision = {
      route: modelRoute.route,
      model: health.model,
      reason: modelRoute.reason,
      fallback_used: health.fallback_used,
    };
    recordDecision(span, modelDecision, shipmentId);

    return { classifier_decision: modelDecision };
  });

  return stateUpdate;
}

export function routeAfterClassify(state: TriageStateType): ClassifyTarget {
  if (state.classifier_decision?.route === CLASSIFIER_ROUTES.DETERMINISTIC) {
    return NODES.HUMAN_APPROVAL;
  }

  return NODES.ROUTE;
}

function findDeterministicOutcome(payload: ShipmentPayload, latestScan: ScanRecord): DeterministicOutcome | null {
  if (latestScan.code !== EVENT_CODES.CUSTOMS_HOLD) {
    return null;
  }

  const countryCode = readText(payload, SHIPMENT_FIELDS.DESTINATION_COUNTRY_CODE);
  const day = (latestScan.timestamp ?? "").slice(0, ISO_DATE_LENGTH);

  if (!countryCode || !day) {
    return null;
  }

  const calendarResult = checkCustomsCalendar(countryCode, day);
  const check = toCalendarCheck(calendarResult);

  if (!check) {
    return null;
  }

  if (check.is_holiday) {
    const holiday: DeterministicOutcome = {
      result: {
        false_positive: true,
        confidence: DETERMINISTIC_CONFIDENCE,
        action: TRIAGE_ACTIONS.NO_ACTION,
        reasoning:
          `Customs hold on ${day}, a public holiday in ${countryCode}. ${check.note} ` +
          `The hold clears when offices reopen, so there is nothing to do.`,
      },
      reason: `${EVENT_CODES.CUSTOMS_HOLD} on a ${countryCode} public holiday, decided from the customs calendar.`,
    };

    return holiday;
  }

  if (check.known_delay_window) {
    const delayWindow: DeterministicOutcome = {
      result: {
        false_positive: true,
        confidence: DETERMINISTIC_CONFIDENCE,
        action: TRIAGE_ACTIONS.NOTIFY_CUSTOMER,
        reasoning:
          `Customs hold on ${day}, inside a known delay window in ${countryCode}. ${check.note} ` +
          `Tell the customer to expect the documented delay.`,
      },
      reason: `${EVENT_CODES.CUSTOMS_HOLD} inside a known ${countryCode} delay window, decided from the customs calendar.`,
    };

    return delayWindow;
  }

  return null;
}

function decideModelRoute(payload: ShipmentPayload, latestScan: ScanRecord): ModelRoute {
  const noteText = `${latestScan.note ?? ""}${NOTE_SEPARATOR}${readText(payload, SHIPMENT_FIELDS.CARRIER_NOTES)}`;
  const isDatedDelay = latestScan.code === EVENT_CODES.EXCEPTION_DELAY && hasDateOrTime(noteText);

  if (isDatedDelay) {
    const smallRoute: ModelRoute = {
      route: CLASSIFIER_ROUTES.SMALL,
      model: MODEL_SMALL,
      reason: `${EVENT_CODES.EXCEPTION_DELAY} note already states a date or time, so a small model can read it.`,
    };

    return smallRoute;
  }

  const strongRoute: ModelRoute = {
    route: CLASSIFIER_ROUTES.STRONG,
    model: MODEL_STRONG,
    reason: "No calendar match and no date or time in the note, so the full specialist decides.",
  };

  return strongRoute;
}

async function resolveModel(requested: string): Promise<ModelHealth> {
  const reachable = await isModelReachable(requested);

  if (reachable) {
    const healthy: ModelHealth = { model: requested, fallback_used: false };

    return healthy;
  }

  const fallback: ModelHealth = { model: MODEL_BACKUP, fallback_used: true };

  return fallback;
}

async function isModelReachable(modelId: string): Promise<boolean> {
  try {
    const pingModel = createModel({ model: modelId, maxTokens: PING_MAX_TOKENS, timeout: PING_TIMEOUT_MS });
    await pingModel.invoke([new HumanMessage(PING_MESSAGE)]);

    return true;
  } catch (error) {
    const preview = String(error).slice(0, PING_ERROR_PREVIEW_LENGTH);
    log({
      level: LOG_LEVELS.WARN,
      event: LOG_EVENTS.CLASSIFIER_FALLBACK,
      message: `[classify] ${modelId} failed its ping, falling back to ${MODEL_BACKUP}: ${preview}`,
      data: { requested: modelId, backup: MODEL_BACKUP, error: preview },
    });

    return false;
  }
}

function recordDecision(span: Span, decision: ClassifierDecision, shipmentId: string): void {
  span.setAttributes({
    [TRACE_ATTRIBUTES.CLASSIFIER_ROUTE]: decision.route,
    [TRACE_ATTRIBUTES.CLASSIFIER_MODEL]: decision.model,
    [TRACE_ATTRIBUTES.CLASSIFIER_REASON]: decision.reason,
    [TRACE_ATTRIBUTES.CLASSIFIER_FALLBACK_USED]: decision.fallback_used,
  });
  log({
    event: LOG_EVENTS.CLASSIFIER_DECISION,
    message: `[classify] ${shipmentId}: route = ${decision.route}, model = ${decision.model || NO_MODEL_LABEL}`,
    data: decision,
  });
}

function hasDateOrTime(text: string): boolean {
  const found = DATE_IN_TEXT_PATTERN.test(text) || TIME_IN_TEXT_PATTERN.test(text);

  return found;
}

function readLatestScan(payload: ShipmentPayload): ScanRecord | null {
  const scans = payload?.[SHIPMENT_FIELDS.SCANS];

  if (!Array.isArray(scans) || scans.length === 0) {
    return null;
  }

  const latest = (scans.at(-1) ?? null) as ScanRecord | null;

  return latest;
}

function readText(payload: ShipmentPayload, field: string): string {
  const value = payload?.[field];

  if (typeof value !== "string") {
    return "";
  }

  return value;
}

function toCalendarCheck(value: unknown): CustomsCalendarCheck | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<CustomsCalendarCheck>;

  if (typeof candidate.is_holiday !== "boolean" || typeof candidate.known_delay_window !== "boolean") {
    return null;
  }

  const check: CustomsCalendarCheck = {
    is_holiday: candidate.is_holiday,
    known_delay_window: candidate.known_delay_window,
    note: typeof candidate.note === "string" ? candidate.note : "",
  };

  return check;
}
