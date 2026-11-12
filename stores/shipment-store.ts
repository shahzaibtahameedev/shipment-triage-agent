import { FIXTURE_FILES } from "../constants.ts";
import { fixtureUrl, normalizeShipmentId, readJson, writeJson } from "./json-file.ts";
import type { Shipment } from "./schemas.ts";

type ShipmentMap = Record<string, Shipment>;

const SHIPMENTS_FILE = fixtureUrl(FIXTURE_FILES.SHIPMENTS);

function readShipments(): ShipmentMap {
  const shipments = readJson<ShipmentMap>(SHIPMENTS_FILE, {});

  return shipments;
}

export function listShipments(): Shipment[] {
  const shipments = Object.values(readShipments());

  return shipments;
}

export function findShipment(shipmentId: string): Shipment | undefined {
  const shipment = readShipments()[normalizeShipmentId(shipmentId)];

  return shipment;
}

export function createShipment(shipment: Shipment): Shipment {
  const shipments = readShipments();
  shipments[shipment.shipment_id] = shipment;
  writeJson(SHIPMENTS_FILE, shipments);

  return shipment;
}

export function deleteShipment(shipmentId: string): boolean {
  const shipments = readShipments();
  const id = normalizeShipmentId(shipmentId);
  const exists = id in shipments;

  if (exists) {
    delete shipments[id];
    writeJson(SHIPMENTS_FILE, shipments);
  }

  return exists;
}
