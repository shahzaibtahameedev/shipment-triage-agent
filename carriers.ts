import { createAgent, AIMessage, HumanMessage, type BaseMessage } from "langchain";
import { model } from "./client.ts";
import { getShipmentHistoryTool, checkCustomsCalendarTool } from "./custom-tool.ts";
import { DHL_PROMPT, MAERSK_PROMPT, REGIONAL_PROMPT } from "./prompt.ts";
import { CARRIERS, TRIAGE_RESULT_SCHEMA, type Carrier, type TriageResult } from "./constants.ts";
import type { TriageStateType } from "./state.ts";
import { trace } from "@opentelemetry/api";
import { tracingMiddleware } from "./tracing.ts";

// Max tool call a model is allowed
const AGENT_CONFIG = { recursionLimit: 12 };

// The three specialists agents
const dhlSpecialist = createAgent({
  model,
  systemPrompt: DHL_PROMPT,
  tools: [getShipmentHistoryTool, checkCustomsCalendarTool],
  responseFormat: TRIAGE_RESULT_SCHEMA,
  middleware: [tracingMiddleware],
});

const maerskSpecialist = createAgent({
  model,
  systemPrompt: MAERSK_PROMPT,
  tools: [getShipmentHistoryTool, checkCustomsCalendarTool],
  responseFormat: TRIAGE_RESULT_SCHEMA,
  middleware: [tracingMiddleware],
});

const regionalSpecialist = createAgent({
  model,
  systemPrompt: REGIONAL_PROMPT,
  tools: [getShipmentHistoryTool],
  responseFormat: TRIAGE_RESULT_SCHEMA,
  middleware: [tracingMiddleware],
});

interface IAgentResponse {
  messages: BaseMessage[];
  structuredResponse: TriageResult;
}



//Nodes
export async function dhlAgent(state: TriageStateType): Promise<Partial<TriageStateType>> {
  const result = await dhlSpecialist.invoke(toAgentMessages(state), AGENT_CONFIG);
  return toStateUpdate(CARRIERS.DHL, result);
}

export async function maerskAgent(state: TriageStateType): Promise<Partial<TriageStateType>> {
  const result = await maerskSpecialist.invoke(toAgentMessages(state), AGENT_CONFIG);
  return toStateUpdate(CARRIERS.MAERSK, result);
}

export async function regionalAgent(state: TriageStateType): Promise<Partial<TriageStateType>> {
  const result = await regionalSpecialist.invoke(toAgentMessages(state), AGENT_CONFIG);
  return toStateUpdate(CARRIERS.REGIONAL_GROUND, result);
}


function toAgentMessages(state: TriageStateType) {
  const { shipment_id, carrier, event_code } = state.event;
  const text =
    `Exception event received.\n` +
    `shipment_id: ${shipment_id}\n` +
    `carrier: ${carrier}\n` +
    `event_code: ${event_code}\n` +
    `Triage it.`;

  return { messages: [new HumanMessage(text)] };
}


// Turn the specialist's answer into the state update for this node
function toStateUpdate(carrier: Carrier, result: IAgentResponse): 
Partial<TriageStateType> {
  logToolCalls(carrier, result.messages);
  const triage = result.structuredResponse;
  console.log(`[${carrier}] action = ${triage.action}, confidence = ${triage.confidence}`);
  trace.getActiveSpan()?.setAttributes({
    "triage.action": triage.action,
    "triage.confidence": triage.confidence,
    "triage.false_positive": triage.false_positive,
  });
  
  return {
    triage_result: triage,
    carrier_findings: [{ carrier, action: triage.action, confidence: triage.confidence }],
  };
}

//Print every tool call the specialist made.
function logToolCalls(carrier: Carrier, messages: BaseMessage[]): void {
  for (const message of messages) {
    if (!AIMessage.isInstance(message)) continue;
    for (const call of message.tool_calls ?? []) {
      console.log(`[${carrier}] tool call: ${call.name}(${JSON.stringify(call.args)})`);
    }
  }
}
