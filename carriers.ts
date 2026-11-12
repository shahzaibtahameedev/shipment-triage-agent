import { createAgent, HumanMessage, type BaseMessage } from "langchain";
import type { Span } from "@opentelemetry/api";
import { model } from "./client.ts";
import { createCustomsCalendarTool, createShipmentHistoryTool } from "./custom-tool.ts";
import { PROMPT_KEYS, PROMPT_PLACEHOLDERS, renderTemplate, type PromptKey } from "./prompt.ts";
import { getPrompt } from "./stores/prompt-store.ts";
import { CARRIERS, TRIAGE_ACTIONS, TRIAGE_RESULT_SCHEMA, type Carrier, type TriageResult } from "./constants.ts";
import type { TriageStateType } from "./state.ts";
import { withAgentSpan, tracingMiddleware, TRACE_ATTRIBUTES } from "./tracing.ts";
import { log, LOG_EVENTS } from "./logger.ts";

// Max tool call a model is allowed
const AGENT_CONFIG = { recursionLimit: 12 };
const PROMPT_SEPARATOR = "\n\n";
const ACTIONS_SEPARATOR = ", ";

const SPECIALIST_PROMPT_KEYS: Record<Carrier, PromptKey> = {
  [CARRIERS.DHL]: PROMPT_KEYS.DHL,
  [CARRIERS.MAERSK]: PROMPT_KEYS.MAERSK,
  [CARRIERS.REGIONAL_GROUND]: PROMPT_KEYS.REGIONAL,
};

// Ground shipments stay inside one country, so they never need the customs calendar
const CARRIERS_WITH_CUSTOMS: Carrier[] = [CARRIERS.DHL, CARRIERS.MAERSK];

interface IAgentResponse {
  messages: BaseMessage[];
  structuredResponse: TriageResult;
}

//Nodes
export async function dhlAgent(state: TriageStateType): Promise<Partial<TriageStateType>> {
  const stateUpdate = await runSpecialist(CARRIERS.DHL, state);

  return stateUpdate;
}

export async function maerskAgent(state: TriageStateType): Promise<Partial<TriageStateType>> {
  const stateUpdate = await runSpecialist(CARRIERS.MAERSK, state);

  return stateUpdate;
}

export async function regionalAgent(state: TriageStateType): Promise<Partial<TriageStateType>> {
  const stateUpdate = await runSpecialist(CARRIERS.REGIONAL_GROUND, state);

  return stateUpdate;
}

// Built on every run so prompt edits apply without a restart
async function runSpecialist(carrier: Carrier, state: TriageStateType): Promise<Partial<TriageStateType>> {
  const stateUpdate = await withAgentSpan(carrier, async (span) => {
    const specialist = createAgent({
      model,
      systemPrompt: buildSystemPrompt(carrier),
      tools: buildTools(carrier),
      responseFormat: TRIAGE_RESULT_SCHEMA,
      middleware: [tracingMiddleware],
    });
    const result = await specialist.invoke(toAgentMessages(state), AGENT_CONFIG);
    const specialistUpdate = toStateUpdate(carrier, result, span);

    return specialistUpdate;
  });

  return stateUpdate;
}

function buildSystemPrompt(carrier: Carrier): string {
  const actions = Object.values(TRIAGE_ACTIONS).join(ACTIONS_SEPARATOR);
  const basePrompt = renderTemplate(getPrompt(PROMPT_KEYS.BASE_TRIAGE), { [PROMPT_PLACEHOLDERS.ACTIONS]: actions });
  const specialistPrompt = getPrompt(SPECIALIST_PROMPT_KEYS[carrier]);
  const systemPrompt = `${basePrompt}${PROMPT_SEPARATOR}${specialistPrompt}`;

  return systemPrompt;
}

function buildTools(carrier: Carrier) {
  const shipmentHistoryTool = createShipmentHistoryTool(getPrompt(PROMPT_KEYS.SHIPMENT_HISTORY_TOOL));

  if (!CARRIERS_WITH_CUSTOMS.includes(carrier)) {
    const tools = [shipmentHistoryTool];

    return tools;
  }

  const customsCalendarTool = createCustomsCalendarTool(getPrompt(PROMPT_KEYS.CUSTOMS_CALENDAR_TOOL));
  const tools = [shipmentHistoryTool, customsCalendarTool];

  return tools;
}

function toAgentMessages(state: TriageStateType) {
  const { shipment_id, carrier, event_code } = state.event;
  const text = renderTemplate(getPrompt(PROMPT_KEYS.EVENT_MESSAGE), {
    [PROMPT_PLACEHOLDERS.SHIPMENT_ID]: shipment_id ?? "",
    [PROMPT_PLACEHOLDERS.CARRIER]: carrier ?? "",
    [PROMPT_PLACEHOLDERS.EVENT_CODE]: event_code ?? "",
  });
  const agentInput = { messages: [new HumanMessage(text)] };

  return agentInput;
}

// Turn the specialist's answer into the state update for this node
function toStateUpdate(carrier: Carrier, result: IAgentResponse, span: Span): Partial<TriageStateType> {
  const triage = result.structuredResponse;
  log({
    event: LOG_EVENTS.SPECIALIST_RESULT,
    message: `[${carrier}] action = ${triage.action}, confidence = ${triage.confidence}`,
    data: { carrier, triage },
  });
  span.setAttributes({
    [TRACE_ATTRIBUTES.TRIAGE_ACTION]: triage.action,
    [TRACE_ATTRIBUTES.TRIAGE_CONFIDENCE]: triage.confidence,
    [TRACE_ATTRIBUTES.TRIAGE_FALSE_POSITIVE]: triage.false_positive,
  });
  const stateUpdate = {
    triage_result: triage,
    carrier_findings: [{ carrier, action: triage.action, confidence: triage.confidence }],
  };

  return stateUpdate;
}
