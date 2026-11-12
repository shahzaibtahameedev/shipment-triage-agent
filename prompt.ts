import { TOOL_DESCRIPTIONS } from "./constants.ts";

export const PROMPT_KEYS = {
  BASE_TRIAGE: "base_triage",
  DHL: "dhl_specialist",
  MAERSK: "maersk_specialist",
  REGIONAL: "regional_specialist",
  EVENT_MESSAGE: "event_message",
  SHIPMENT_HISTORY_TOOL: "tool_get_shipment_history",
  CUSTOMS_CALENDAR_TOOL: "tool_check_customs_calendar",
} as const;

export type PromptKey = (typeof PROMPT_KEYS)[keyof typeof PROMPT_KEYS];

export const PROMPT_GROUPS = {
  SYSTEM: "system",
  MESSAGE: "message",
  TOOL: "tool",
} as const;

export type PromptGroup = (typeof PROMPT_GROUPS)[keyof typeof PROMPT_GROUPS];

export const PROMPT_PLACEHOLDERS = {
  ACTIONS: "actions",
  SHIPMENT_ID: "shipment_id",
  CARRIER: "carrier",
  EVENT_CODE: "event_code",
} as const;

export interface PromptDefinition {
  key: PromptKey;
  label: string;
  group: PromptGroup;
  description: string;
  placeholders: string[];
  content: string;
}

const PLACEHOLDER_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

const BASE_TRIAGE = `You are a shipment-exception triage assistant. Given an exception
event, use the available tools to gather context, then produce a triage
recommendation. Do not take action yourself — only recommend.

Your final answer must state:
- whether this is a false positive (true/false)
- your confidence (0.0 to 1.0)
- one recommended action: {{actions}}
- a short reasoning paragraph`;

const DHL_PROMPT = `You are the DHL specialist. DHL shipments here are international air express.
What usually matters:
- Customs documents: a customs hold is often a missing or wrong commercial invoice,
  or a broker asking for documents. Paperwork is fixed by the shipper or carrier,
  not by rerouting.
- Cold chain: for temperature-controlled cargo, compare every temperature reading
  with the allowed range. A reading outside the range is a real problem.
- Air express transit is short, so even a 1-2 day hold can miss the promised delivery.
- Check the customs calendar for the destination country on the hold date.`;

const MAERSK_PROMPT = `You are the Maersk specialist. Maersk shipments here are ocean freight in containers.
What usually matters:
- Port holidays: check the customs calendar for the destination country on the
  arrival or hold date. A hold during a holiday usually clears when offices reopen.
- Port closures (strikes, weather) and vessel delays: compare how long the delay
  will last with the promised delivery date and, for perishable cargo, how much
  shelf life is left.
- Reroute: choose recommend_reroute only when waiting would clearly do more harm
  than diverting AND a nearby alternate port with capacity is available.
  A human approves every reroute before anything happens.
- Past customs history with the same shipper and consignee is a strong signal.`;

const REGIONAL_PROMPT = `You are the regional ground specialist. These shipments move by road inside one
country, so there is no customs.
What usually matters:
- Scan SLA: compare the time since the last scan with scan_sla_hours (if given).
  A gap still inside the SLA is not yet a problem.
- Driver rest rules: drivers must take mandatory rest breaks. A delay explained by
  a rest break, with a new ETA, is normal operations.
- Compare any new ETA with the promised delivery.`;

const EVENT_MESSAGE = `Exception event received.
shipment_id: {{shipment_id}}
carrier: {{carrier}}
event_code: {{event_code}}
Triage it.`;

const SPECIALIST_NOTE = "Added after the base triage instructions for this carrier's specialist.";

export const DEFAULT_PROMPTS: Record<PromptKey, PromptDefinition> = {
  [PROMPT_KEYS.BASE_TRIAGE]: {
    key: PROMPT_KEYS.BASE_TRIAGE,
    label: "Base triage instructions",
    group: PROMPT_GROUPS.SYSTEM,
    description: "Shared system prompt placed before every specialist prompt.",
    placeholders: [PROMPT_PLACEHOLDERS.ACTIONS],
    content: BASE_TRIAGE,
  },
  [PROMPT_KEYS.DHL]: {
    key: PROMPT_KEYS.DHL,
    label: "DHL specialist",
    group: PROMPT_GROUPS.SYSTEM,
    description: SPECIALIST_NOTE,
    placeholders: [],
    content: DHL_PROMPT,
  },
  [PROMPT_KEYS.MAERSK]: {
    key: PROMPT_KEYS.MAERSK,
    label: "Maersk specialist",
    group: PROMPT_GROUPS.SYSTEM,
    description: SPECIALIST_NOTE,
    placeholders: [],
    content: MAERSK_PROMPT,
  },
  [PROMPT_KEYS.REGIONAL]: {
    key: PROMPT_KEYS.REGIONAL,
    label: "Regional ground specialist",
    group: PROMPT_GROUPS.SYSTEM,
    description: SPECIALIST_NOTE,
    placeholders: [],
    content: REGIONAL_PROMPT,
  },
  [PROMPT_KEYS.EVENT_MESSAGE]: {
    key: PROMPT_KEYS.EVENT_MESSAGE,
    label: "Exception event message",
    group: PROMPT_GROUPS.MESSAGE,
    description: "The user message sent to the specialist for each exception event.",
    placeholders: [PROMPT_PLACEHOLDERS.SHIPMENT_ID, PROMPT_PLACEHOLDERS.CARRIER, PROMPT_PLACEHOLDERS.EVENT_CODE],
    content: EVENT_MESSAGE,
  },
  [PROMPT_KEYS.SHIPMENT_HISTORY_TOOL]: {
    key: PROMPT_KEYS.SHIPMENT_HISTORY_TOOL,
    label: "get_shipment_history",
    group: PROMPT_GROUPS.TOOL,
    description: "Tool description the model reads when deciding to fetch a shipment.",
    placeholders: [],
    content: TOOL_DESCRIPTIONS.GET_SHIPMENT_HISTORY,
  },
  [PROMPT_KEYS.CUSTOMS_CALENDAR_TOOL]: {
    key: PROMPT_KEYS.CUSTOMS_CALENDAR_TOOL,
    label: "check_customs_calendar",
    group: PROMPT_GROUPS.TOOL,
    description: "Tool description the model reads when deciding to check holidays. DHL and Maersk only.",
    placeholders: [],
    content: TOOL_DESCRIPTIONS.CHECK_CUSTOMS_CALENDAR,
  },
};

export function renderTemplate(template: string, values: Record<string, string>): string {
  const rendered = template.replace(PLACEHOLDER_PATTERN, (match: string, name: string) => values[name] ?? match);

  return rendered;
}
