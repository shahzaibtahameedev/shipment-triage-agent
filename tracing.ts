import "dotenv/config";
import { trace, SpanStatusCode, type Attributes, type Span } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { isGraphInterrupt } from "@langchain/langgraph";


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
