import { CARRIERS, NODES } from "./constants.ts";
import type { TriageStateType } from "./state.ts";

export function routeNode(state: TriageStateType): Partial<TriageStateType> {
  console.log(`[route] ${state.event.shipment_id}: carrier = ${state.event.carrier}`);
  return {};
}

export type CarrierNode = typeof NODES.DHL | typeof NODES.MAERSK | typeof NODES.REGIONAL;

//Deterministic Routing
export function routeToCarrier(state: TriageStateType): CarrierNode {
  switch (state.event.carrier) {
    case CARRIERS.DHL:
      return NODES.DHL;
    case CARRIERS.MAERSK:
      return NODES.MAERSK;
    case CARRIERS.REGIONAL_GROUND:
      return NODES.REGIONAL;
    default:
      throw new Error(`No specialist for carrier: ${String(state.event.carrier)}`);
  }
}
