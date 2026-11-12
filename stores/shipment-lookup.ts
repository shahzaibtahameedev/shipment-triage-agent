import type { Shipment } from "./schemas.ts";
import { findShipment } from "./shipment-store.ts";
import { findTestShipment } from "./test-shipment-store.ts";

// Test shipments are looked up too, but only their shipment data, never the expected result.
export function findShipmentForAgent(shipmentId: string): Shipment | undefined {
  const shipment = findShipment(shipmentId) ?? findTestShipment(shipmentId)?.shipment;

  return shipment;
}

export function isShipmentIdTaken(shipmentId: string): boolean {
  const isTaken = findShipmentForAgent(shipmentId) !== undefined;

  return isTaken;
}
