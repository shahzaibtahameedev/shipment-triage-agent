import { FIXTURE_FILES } from "../constants.ts";
import { fixtureUrl, normalizeShipmentId, readJson, writeJson } from "./json-file.ts";
import type { TestShipment } from "./schemas.ts";

type TestShipmentMap = Record<string, TestShipment>;

const TEST_SHIPMENTS_FILE = fixtureUrl(FIXTURE_FILES.TEST_SHIPMENTS);

function readTestShipments(): TestShipmentMap {
  const testShipments = readJson<TestShipmentMap>(TEST_SHIPMENTS_FILE, {});

  return testShipments;
}

export function listTestShipments(): TestShipment[] {
  const testShipments = Object.values(readTestShipments());

  return testShipments;
}

export function findTestShipment(shipmentId: string): TestShipment | undefined {
  const testShipment = readTestShipments()[normalizeShipmentId(shipmentId)];

  return testShipment;
}

export function updateTestShipment(testShipment: TestShipment): TestShipment {
  const testShipments = readTestShipments();
  testShipments[testShipment.shipment.shipment_id] = testShipment;
  writeJson(TEST_SHIPMENTS_FILE, testShipments);

  return testShipment;
}

export function deleteTestShipment(shipmentId: string): boolean {
  const testShipments = readTestShipments();
  const id = normalizeShipmentId(shipmentId);
  const exists = id in testShipments;

  if (exists) {
    delete testShipments[id];
    writeJson(TEST_SHIPMENTS_FILE, testShipments);
  }

  return exists;
}
