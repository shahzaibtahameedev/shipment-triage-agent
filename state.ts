import { Annotation } from "@langchain/langgraph";
import { CARRIERS, type Carrier, type HumanDecision, type TriageAction, type TriageResult } from "./constants.ts";
import { findShipmentForAgent } from "./stores/shipment-lookup.ts";

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

export function buildEvent(shipmentId: string): ExceptionEvent {
  const shipment = findShipmentForAgent(shipmentId);

  if (!shipment) {
    throw new Error(`Shipment ${shipmentId} not found`);
  }

  // Fixtures are read without schema validation, so the shape is checked here
  const { carrier, scans } = shipment;

  if (!isCarrier(carrier)) {
    throw new Error(`Shipment ${shipmentId} has unknown carrier "${carrier}"`);
  }

  if (!Array.isArray(scans) || scans.length === 0) {
    throw new Error(`Shipment ${shipmentId} has no scans`);
  }

  const event = {
    shipment_id: shipmentId,
    carrier,
    event_code: scans.at(-1)?.code ?? "",
    raw_payload: shipment,
  };

  return event;
}

function isCarrier(value: string): value is Carrier {
  return (Object.values(CARRIERS) as string[]).includes(value);
}
