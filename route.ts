import { CARRIERS, NODES } from "./constants.ts";
import type { TriageStateType } from "./state.ts";
import { log, LOG_EVENTS } from "./logger.ts";
import { withNodeSpan, TRACE_ATTRIBUTES } from "./tracing.ts";

export async function routeNode(state: TriageStateType): Promise<Partial<TriageStateType>> {
  const stateUpdate = await withNodeSpan(NODES.ROUTE, (span) => {
    const { shipment_id, carrier, event_code } = state.event;
    span.setAttribute(TRACE_ATTRIBUTES.CARRIER, carrier ?? "");
    log({
      event: LOG_EVENTS.ROUTE_SELECTED,
      message: `[route] ${shipment_id}: carrier = ${carrier}`,
      data: { carrier, event_code },
    });

    return {};
  });

  return stateUpdate;
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
