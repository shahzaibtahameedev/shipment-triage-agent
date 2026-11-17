import { Hono } from "hono";
import { normalizeShipmentId } from "../../stores/json-file.ts";
import { TEST_SHIPMENT_SCHEMA } from "../../stores/schemas.ts";
import {
  deleteTestShipment,
  findTestShipment,
  listTestShipments,
  updateTestShipment,
} from "../../stores/test-shipment-store.ts";
import { badRequest, notFound, parseJsonBody, HTTP_STATUS } from "../http.ts";

export const testShipmentsRoute = new Hono();

testShipmentsRoute.get("/", (c) => {
  const testShipments = listTestShipments();

  return c.json(testShipments);
});

testShipmentsRoute.get("/:id", (c) => {
  const shipmentId = c.req.param("id");
  const testShipment = findTestShipment(shipmentId);

  if (!testShipment) {
    throw notFound(`Test shipment ${shipmentId} not found`);
  }

  return c.json(testShipment);
});

testShipmentsRoute.put("/:id", async (c) => {
  const shipmentId = normalizeShipmentId(c.req.param("id"));
  const testShipment = await parseJsonBody(c, TEST_SHIPMENT_SCHEMA);

  if (!findTestShipment(shipmentId)) {
    throw notFound(`Test shipment ${shipmentId} not found`);
  }

  if (testShipment.shipment.shipment_id !== shipmentId) {
    throw badRequest(`shipment_id must stay ${shipmentId}`);
  }

  const updated = updateTestShipment(testShipment);

  return c.json(updated);
});

testShipmentsRoute.delete("/:id", (c) => {
  const shipmentId = c.req.param("id");
  const isDeleted = deleteTestShipment(shipmentId);

  if (!isDeleted) {
    throw notFound(`Test shipment ${shipmentId} not found`);
  }

  return c.body(null, HTTP_STATUS.NO_CONTENT);
});
