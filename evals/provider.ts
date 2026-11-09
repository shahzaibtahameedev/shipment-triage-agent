import { randomUUID } from "node:crypto";
import { MemorySaver } from "@langchain/langgraph";
import type { ApiProvider, CallApiContextParams, ProviderOptions, ProviderResponse } from "promptfoo";
import { buildWorkflow } from "../graph.ts";
import { buildEvent } from "../state.ts";
import { evalHooks } from "../custom-tool.ts";
import { NODES } from "../constants.ts";

export default class TriageGraphProvider implements ApiProvider {
  config: { base_shipment?: string };

  constructor(options: ProviderOptions = {}) {
    this.config = options.config ?? {};
  }

  id() {
    return "triage-graph";
  }

  async callApi(_prompt: string, context?: CallApiContextParams): Promise<ProviderResponse> {
    const vars = context?.vars ?? {};
    const shipmentId = String(vars.shipment_id ?? this.config.base_shipment ?? "").trim().toUpperCase();

    evalHooks.calls.length = 0;
    evalHooks.carrierNote = vars.carrier_note ? String(vars.carrier_note) : "";

    try {
      const event = buildEvent(shipmentId);
      const graph = buildWorkflow().compile({
        checkpointer: new MemorySaver(),
        interruptBefore: [NODES.HUMAN_APPROVAL],
      });

      const state = await graph.invoke(
        { event, triage_result: null, needs_human_approval: false, human_decision: null },
        { configurable: { thread_id: randomUUID() } },
      );

      const toolCalls = [...evalHooks.calls];

      const testResult = {
        output: { triage: state.triage_result, carrier: event.carrier, tool_calls: toolCalls }
      }

      return testResult;
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    } finally {
      evalHooks.carrierNote = "";
    }
  }
}
