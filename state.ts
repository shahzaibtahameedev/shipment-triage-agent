import { Annotation } from "@langchain/langgraph";
import type { Carrier, HumanDecision, TriageAction, TriageResult } from "./constants.ts";

export interface ExceptionEvent {
  shipment_id?: string;
  carrier?: Carrier;
  event_code?: string;
  raw_payload?: Record<string, unknown>;
}

export interface CarrierFinding {
  carrier: Carrier;
  action: TriageAction;
  confidence: number;
}

export const TriageState = Annotation.Root({
  // Latest node value
  event: Annotation<ExceptionEvent>(),
  triage_result: Annotation<TriageResult | null>(),
  needs_human_approval: Annotation<boolean>(),
  human_decision: Annotation<HumanDecision | null>(),
  
  //Appends to current carrier findings returned from a node
  carrier_findings: Annotation<CarrierFinding[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),
});

export type TriageStateType = typeof TriageState.State;
