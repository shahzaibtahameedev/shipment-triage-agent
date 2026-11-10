import "dotenv/config";
import { trace, SpanStatusCode, type Attributes, type Span } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { isGraphInterrupt } from "@langchain/langgraph";
import { createMiddleware, ToolMessage } from "langchain";


const tracer = trace.getTracer("shipment-triage");
let provider: NodeTracerProvider | undefined;

export function startTracing(): void {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) return;
  try {
    const processor = new LangfuseSpanProcessor({ shouldExportSpan: () => true });
    provider = new NodeTracerProvider({ spanProcessors: [processor] });
    provider.register();
  } catch (err) {
    console.warn("[tracing] disabled:", err);
  }
}

export async function stopTracing(): Promise<void> {
  try {
    await provider?.shutdown();
  } catch (err) {
    console.warn("[tracing] flush failed:", err);
  }
}


export function withSpan<T>(name: string, attributes: Attributes, fn: (span: Span) => T | Promise<T>): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn(span);
    } catch (err) {
      if (isGraphInterrupt(err)) {
        span.setAttribute("graph.interrupted", true);
      } else {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      }
      throw err;
    } finally {
      span.end();
    }
  });
}

export function traceRun<T>(kind: "triage" | "resume", shipmentId: string, fn: () => Promise<T>): Promise<T> {
  return withSpan(`${kind} ${shipmentId}`, { shipment_id: shipmentId, thread_id: shipmentId }, fn);
}

export function traceNode<A extends unknown[], R>(name: string, attributes: Attributes, node: (...args: A) => R | Promise<R>) {
  return (...args: A) => withSpan(name, attributes, () => node(...args));
}

export function traceAgent<A extends unknown[], R>(agentName: string, node: (...args: A) => R | Promise<R>) {
  return traceNode(`invoke_agent ${agentName}`, {
    "gen_ai.operation.name": "invoke_agent",
    "gen_ai.agent.name": agentName,
    "gen_ai.agent.id": `shipment-triage.${agentName}`,
    "langfuse.observation.type": "agent",
  }, node);
}

const captureContent = process.env.TRACE_CONTENT !== "false";
const PII_KEY = /customer|name|email|phone|address|contact|consignee/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE = /\+\d[\d\s-]{7,}\d/g;

export function redact(value: unknown, key = ""): unknown {
  if (PII_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") return value.replace(EMAIL, "[EMAIL]").replace(PHONE, "[PHONE]");
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
  }
  return value;
}

function toSafeJson(value: unknown): string {
  try {
    return JSON.stringify(redact(typeof value === "string" ? JSON.parse(value) : value));
  } catch {
    return String(redact(String(value)));
  }
}

export const tracingMiddleware = createMiddleware({
  name: "OtelTracing",
  wrapToolCall: (request, handler) => {
    const { name, args } = request.toolCall;
    return withSpan(`execute_tool ${name}`, {
      "gen_ai.operation.name": "execute_tool",
      "gen_ai.tool.name": name,
      "langfuse.observation.type": "tool",
    }, async (span) => {
      if (captureContent) span.setAttribute("gen_ai.tool.call.arguments", toSafeJson(args));
      const result = await handler(request);
      if (ToolMessage.isInstance(result)) {
        if (captureContent) span.setAttribute("gen_ai.tool.call.result", toSafeJson(result.content));
        if (result.status === "error") span.setStatus({ code: SpanStatusCode.ERROR });
      }
      return result;
    });
  },
});
