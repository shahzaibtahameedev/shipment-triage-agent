import { interrupt } from "@langchain/langgraph";
import { TRIAGE_ACTIONS, type HumanDecision, type TriageResult } from "./constants.ts";
import type { TriageStateType } from "./state.ts";

export interface ApprovalRequest {
  triage_result: TriageResult;
}

export interface ApprovalResponse {
  decision: HumanDecision;
}

export function humanApprovalNode(state: TriageStateType): Partial<TriageStateType> {
  if (!state.triage_result || state.triage_result.action !== TRIAGE_ACTIONS.RECOMMEND_REROUTE) {
    return { needs_human_approval: false };
  }

  const { decision } = interrupt<ApprovalRequest, ApprovalResponse>({
    triage_result: state.triage_result,
  });

  console.log(`[human_approval] ${state.event.shipment_id}: ${decision}`);
  return { needs_human_approval: true, human_decision: decision };
}
