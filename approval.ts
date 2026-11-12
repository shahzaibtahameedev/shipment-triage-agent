import { interrupt } from "@langchain/langgraph";
import { NODES, TRIAGE_ACTIONS, type HumanDecision, type TriageResult } from "./constants.ts";
import type { TriageStateType } from "./state.ts";
import { log, LOG_EVENTS } from "./logger.ts";
import { withNodeSpan, TRACE_ATTRIBUTES } from "./tracing.ts";

export interface ApprovalRequest {
  triage_result: TriageResult;
}

export interface ApprovalResponse {
  decision: HumanDecision;
}

export async function humanApprovalNode(state: TriageStateType): Promise<Partial<TriageStateType>> {
  const stateUpdate = await withNodeSpan(NODES.HUMAN_APPROVAL, (span) => {
    const triageResult = state.triage_result;

    if (!triageResult || triageResult.action !== TRIAGE_ACTIONS.RECOMMEND_REROUTE) {
      span.setAttribute(TRACE_ATTRIBUTES.NEEDS_HUMAN_APPROVAL, false);

      return { needs_human_approval: false };
    }

    span.setAttribute(TRACE_ATTRIBUTES.NEEDS_HUMAN_APPROVAL, true);
    const { decision } = interrupt<ApprovalRequest, ApprovalResponse>({ triage_result: triageResult });
    span.setAttribute(TRACE_ATTRIBUTES.HUMAN_DECISION, decision);
    log({
      event: LOG_EVENTS.HUMAN_DECISION,
      message: `[human_approval] ${state.event.shipment_id}: ${decision}`,
      data: { decision },
    });

    return { needs_human_approval: true, human_decision: decision };
  });

  return stateUpdate;
}
