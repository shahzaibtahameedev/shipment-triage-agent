import "dotenv/config";
import {
  trace,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  SpanStatusCode,
  type Attributes,
  type Span,
} from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { propagateAttributes } from "@langfuse/tracing";
import { isGraphInterrupt } from "@langchain/langgraph";
import { createMiddleware, AIMessage, ToolMessage, type BaseMessage } from "langchain";
import type { RunKind } from "./logger.ts";

const SERVICE_NAME = "shipment-triage";
const MIDDLEWARE_NAME = "OtelTracing";
const DEFAULT_LANGFUSE_HOST = "https://cloud.langfuse.com (default EU)";
const UNKNOWN_MODEL = "unknown";
const TOOL_ERROR_STATUS = "error";

const OPERATIONS = {
  INVOKE_AGENT: "invoke_agent",
  CHAT: "chat",
  EXECUTE_TOOL: "execute_tool",
} as const;

const OBSERVATION_TYPES = {
  AGENT: "agent",
  GENERATION: "generation",
  TOOL: "tool",
} as const;

// Every attribute this app puts on a span, in one place
export const TRACE_ATTRIBUTES = {
  OPERATION: "gen_ai.operation.name",
  AGENT_NAME: "gen_ai.agent.name",
  AGENT_ID: "gen_ai.agent.id",
  REQUEST_MODEL: "gen_ai.request.model",
  RESPONSE_MODEL: "gen_ai.response.model",
  INPUT_TOKENS: "gen_ai.usage.input_tokens",
  OUTPUT_TOKENS: "gen_ai.usage.output_tokens",
  FINISH_REASONS: "gen_ai.response.finish_reasons",
  TOOL_NAME: "gen_ai.tool.name",
  TOOL_ARGUMENTS: "gen_ai.tool.call.arguments",
  TOOL_RESULT: "gen_ai.tool.call.result",
  OBSERVATION_TYPE: "langfuse.observation.type",
  OBSERVATION_INPUT: "langfuse.observation.input",
  OBSERVATION_OUTPUT: "langfuse.observation.output",
  SHIPMENT_ID: "shipment_id",
  THREAD_ID: "thread_id",
  CARRIER: "carrier",
  GRAPH_INTERRUPTED: "graph.interrupted",
  TRIAGE_ACTION: "triage.action",
  TRIAGE_CONFIDENCE: "triage.confidence",
  TRIAGE_FALSE_POSITIVE: "triage.false_positive",
  NEEDS_HUMAN_APPROVAL: "needs_human_approval",
  HUMAN_DECISION: "human_decision",
} as const;

const tracer = trace.getTracer(SERVICE_NAME);
const captureContent = process.env.TRACE_CONTENT !== "false";

let provider: NodeTracerProvider | undefined;

export function startTracing(): void {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    console.warn("[tracing] off: LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY not set");

    return;
  }

  try {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);
    console.log(`[tracing] on, sending to ${process.env.LANGFUSE_BASE_URL || DEFAULT_LANGFUSE_HOST}`);
    const spanProcessor = new LangfuseSpanProcessor({ shouldExportSpan: () => true });
    provider = new NodeTracerProvider({ spanProcessors: [spanProcessor] });
    provider.register();
  } catch (error) {
    console.warn("[tracing] disabled:", error);
  }
}

export async function stopTracing(): Promise<void> {
  try {
    await provider?.shutdown();
  } catch (error) {
    console.warn("[tracing] flush failed:", error);
  }
}

// The only place a span is opened. Everything below builds its attributes and calls it once.
function withSpan<T>(name: string, attributes: Attributes, body: (span: Span) => Promise<T> | T): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await body(span);

      return result;
    } catch (error) {
      recordSpanFailure(span, error);
      throw error;
    } finally {
      span.end();
    }
  });
}

// A graph interrupt is a planned pause for human approval, not a failure
function recordSpanFailure(span: Span, error: unknown): void {
  if (isGraphInterrupt(error)) {
    span.setAttribute(TRACE_ATTRIBUTES.GRAPH_INTERRUPTED, true);

    return;
  }

  const message = String(error);
  span.recordException(error instanceof Error ? error : message);
  span.setStatus({ code: SpanStatusCode.ERROR, message });
}

// Root span of a trace: one triage or resume of a single shipment
export function withRunSpan<T>(kind: RunKind, shipmentId: string, body: (span: Span) => Promise<T>): Promise<T> {
  const name = `${kind} ${shipmentId}`;
  const attributes: Attributes = {
    [TRACE_ATTRIBUTES.SHIPMENT_ID]: shipmentId,
    [TRACE_ATTRIBUTES.THREAD_ID]: shipmentId,
  };
  const traced = propagateAttributes({ sessionId: shipmentId, traceName: name }, () =>
    withSpan(name, attributes, body),
  );

  return traced;
}

// Span for one carrier specialist. Its model and tool spans nest under it.
export function withAgentSpan<T>(agentName: string, body: (span: Span) => Promise<T> | T): Promise<T> {
  const attributes: Attributes = {
    [TRACE_ATTRIBUTES.OPERATION]: OPERATIONS.INVOKE_AGENT,
    [TRACE_ATTRIBUTES.AGENT_NAME]: agentName,
    [TRACE_ATTRIBUTES.AGENT_ID]: `${SERVICE_NAME}.${agentName}`,
    [TRACE_ATTRIBUTES.OBSERVATION_TYPE]: OBSERVATION_TYPES.AGENT,
  };
  const traced = withSpan(`${OPERATIONS.INVOKE_AGENT} ${agentName}`, attributes, body);

  return traced;
}

// Span for a deterministic graph node that does no model work
export function withNodeSpan<T>(nodeName: string, body: (span: Span) => Promise<T> | T): Promise<T> {
  const traced = withSpan(nodeName, {}, body);

  return traced;
}

const PII_KEY_PATTERN = /customer|name|email|phone|address|contact|consignee/i;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_PATTERN = /\+\d[\d\s-]{7,}\d/g;
const JSON_START_PATTERN = /^\s*[{[]/;
const REDACTED = "[REDACTED]";
const EMAIL_MASK = "[EMAIL]";
const PHONE_MASK = "[PHONE]";
const UNSERIALIZABLE = "[unserializable]";

export function redact(value: unknown, key = ""): unknown {
  if (PII_KEY_PATTERN.test(key)) {
    return REDACTED;
  }

  if (typeof value === "string") {
    const redactedText = redactText(value);

    return redactedText;
  }

  if (Array.isArray(value)) {
    const redactedItems = value.map((item) => redact(item));

    return redactedItems;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redact(entryValue, entryKey)]);
    const redactedObject = Object.fromEntries(entries);

    return redactedObject;
  }

  return value;
}

function redactText(value: string): unknown {
  if (JSON_START_PATTERN.test(value)) {
    try {
      const redactedJson = redact(JSON.parse(value));

      return redactedJson;
    } catch {
      // Not JSON after all, so fall through and mask the raw text
    }
  }

  const masked = value.replace(EMAIL_PATTERN, EMAIL_MASK).replace(PHONE_PATTERN, PHONE_MASK);

  return masked;
}

function toSafeJson(value: unknown): string {
  try {
    const json = JSON.stringify(redact(value)) ?? "";

    return json;
  } catch {
    return UNSERIALIZABLE;
  }
}

function setContent(span: Span, key: string, value: unknown): void {
  if (!captureContent) {
    return;
  }

  span.setAttribute(key, toSafeJson(value));
}

interface TracedChatMessage {
  role: string;
  content: unknown;
  tool_calls?: { tool: string; args: unknown }[];
}

function toChatMessage(message: BaseMessage): TracedChatMessage {
  const chatMessage: TracedChatMessage = { role: message.type, content: message.content };

  if (AIMessage.isInstance(message) && message.tool_calls?.length) {
    chatMessage.tool_calls = message.tool_calls.map((call) => ({ tool: call.name, args: call.args }));
  }

  return chatMessage;
}

function toModelName(model: unknown): string {
  const namedModel = model as { model?: string };
  const modelName = namedModel.model ?? UNKNOWN_MODEL;

  return modelName;
}

function toPromptMessages(systemMessage: BaseMessage | undefined, messages: BaseMessage[]): TracedChatMessage[] {
  const prompt = systemMessage ? [systemMessage].concat(messages) : messages;
  const chatMessages = prompt.map((message) => toChatMessage(message));

  return chatMessages;
}

function toResponseAttributes(response: AIMessage): Attributes {
  const finishReason = response.response_metadata?.finish_reason;
  const attributes: Attributes = {
    [TRACE_ATTRIBUTES.RESPONSE_MODEL]: response.response_metadata?.model_name,
    [TRACE_ATTRIBUTES.INPUT_TOKENS]: response.usage_metadata?.input_tokens,
    [TRACE_ATTRIBUTES.OUTPUT_TOKENS]: response.usage_metadata?.output_tokens,
    [TRACE_ATTRIBUTES.FINISH_REASONS]: finishReason ? [String(finishReason)] : undefined,
  };

  return attributes;
}

export const tracingMiddleware = createMiddleware({
  name: MIDDLEWARE_NAME,
  wrapModelCall: (request, handler) => {
    const modelName = toModelName(request.model);
    const attributes: Attributes = {
      [TRACE_ATTRIBUTES.OPERATION]: OPERATIONS.CHAT,
      [TRACE_ATTRIBUTES.REQUEST_MODEL]: modelName,
      [TRACE_ATTRIBUTES.OBSERVATION_TYPE]: OBSERVATION_TYPES.GENERATION,
    };

    return withSpan(`${OPERATIONS.CHAT} ${modelName}`, attributes, async (span) => {
      setContent(span, TRACE_ATTRIBUTES.OBSERVATION_INPUT, toPromptMessages(request.systemMessage, request.messages));
      const response = await handler(request);
      setContent(span, TRACE_ATTRIBUTES.OBSERVATION_OUTPUT, toChatMessage(response));
      span.setAttributes(toResponseAttributes(response));

      return response;
    });
  },
  wrapToolCall: (request, handler) => {
    const { name, args } = request.toolCall;
    const attributes: Attributes = {
      [TRACE_ATTRIBUTES.OPERATION]: OPERATIONS.EXECUTE_TOOL,
      [TRACE_ATTRIBUTES.TOOL_NAME]: name,
      [TRACE_ATTRIBUTES.OBSERVATION_TYPE]: OBSERVATION_TYPES.TOOL,
    };

    return withSpan(`${OPERATIONS.EXECUTE_TOOL} ${name}`, attributes, async (span) => {
      setContent(span, TRACE_ATTRIBUTES.TOOL_ARGUMENTS, args);
      const result = await handler(request);

      if (!ToolMessage.isInstance(result)) {
        return result;
      }

      setContent(span, TRACE_ATTRIBUTES.TOOL_RESULT, result.content);

      if (result.status === TOOL_ERROR_STATUS) {
        span.setStatus({ code: SpanStatusCode.ERROR });
      }

      return result;
    });
  },
});
