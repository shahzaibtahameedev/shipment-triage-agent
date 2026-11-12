import { z } from "zod";

export const TOOL_NAMES = {
    GET_SHIPMENT_HISTORY: "get_shipment_history",
    CHECK_CUSTOMS_CALENDAR: "check_customs_calendar",
} as const;

export const TOOL_DESCRIPTIONS = {
    GET_SHIPMENT_HISTORY:
        "Fetch the full scan history and metadata for one shipment: carrier, " +
        "origin, destination (with country code), cargo, promised delivery, " +
        "every status scan with timestamps, temperature readings for " +
        "cold-chain cargo, and past customs history.",
    CHECK_CUSTOMS_CALENDAR:
        "Check whether a date in a given country falls on a public holiday " +
        "or a known customs delay window (e.g. Lunar New Year).",
} as const;

export const FIXTURE_FILES = {
    SHIPMENTS: "shipments.json",
    TEST_SHIPMENTS: "test-shipments.json",
    CUSTOMS_CALENDAR: "customs_calendar.json",
    PROMPT_OVERRIDES: "prompt-overrides.json",
} as const;

export const SHIPMENT_ID_PATTERN = /^SH-\d{4,}$/;

export const TOOL_ERRORS = {
    SHIPMENT_NOT_FOUND: "shipment_not_found",
    INVALID_DATE: "invalid_date",
} as const;

export const TOOL_MESSAGES = {
    SHIPMENT_NOT_FOUND_HINT: "Check the ID. Known IDs look like 'SH-1001'.",
    INVALID_DATE_HINT: "Use ISO format YYYY-MM-DD, e.g. '2026-12-02'.",
    NORMAL_WORKING_DAY_NOTE: "Normal working day. No holiday or known delay window.",
} as const;

export const CALENDAR_KINDS = {
    HOLIDAY: "holiday",
    DELAY_WINDOW: "delay_window",
} as const;

export type CalendarKind = (typeof CALENDAR_KINDS)[keyof typeof CALENDAR_KINDS];

export const ISO_DATE_LENGTH = 10;
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const CARRIERS = {
    DHL: "dhl",
    MAERSK: "maersk",
    REGIONAL_GROUND: "regional_ground",
} as const;

export type Carrier = (typeof CARRIERS)[keyof typeof CARRIERS];

//Node names in the graph
export const NODES = {
    ROUTE: "route",
    DHL: "dhl",
    MAERSK: "maersk",
    REGIONAL: "regional",
    HUMAN_APPROVAL: "human_approval",
} as const;

// What a human can answer at the approval pause.
export const HUMAN_DECISIONS = {
    APPROVED: "approved",
    REJECTED: "rejected",
} as const;

export type HumanDecision = (typeof HUMAN_DECISIONS)[keyof typeof HUMAN_DECISIONS];

// The actions a specialist may recommend
export const TRIAGE_ACTIONS = {
    NO_ACTION: "no_action",
    NOTIFY_CUSTOMER: "notify_customer",
    ESCALATE_CARRIER: "escalate_carrier",
    RECOMMEND_REROUTE: "recommend_reroute",
    NEEDS_HUMAN_REVIEW: "needs_human_review",
} as const;

export type TriageAction = (typeof TRIAGE_ACTIONS)[keyof typeof TRIAGE_ACTIONS];

export const TRIAGE_RESULT_SCHEMA = z
    .object({
        false_positive: z.boolean().describe("True if this exception is a false positive."),
        confidence: z.number().min(0).max(1).describe("Confidence from 0.0 to 1.0."),
        action: z.enum(TRIAGE_ACTIONS).describe("The one recommended action."),
        reasoning: z.string().describe("A short reasoning paragraph."),
    })
    .meta({ title: "triage_result", description: "Your final triage recommendation." });

export type TriageResult = z.infer<typeof TRIAGE_RESULT_SCHEMA>;
