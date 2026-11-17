import { Hono } from "hono";
import { SHIPMENT_SCHEMA } from "../../stores/schemas.ts";
import { createShipment, deleteShipment, findShipment, listShipments } from "../../stores/shipment-store.ts";
import { isShipmentIdTaken } from "../../stores/shipment-lookup.ts";
import { conflict, notFound, parseJsonBody, HTTP_STATUS } from "../http.ts";

export const shipmentsRoute = new Hono();

shipmentsRoute.get("/", (c) => {
  const shipments = listShipments();

  return c.json(shipments);
});

shipmentsRoute.get("/:id", (c) => {
  const shipmentId = c.req.param("id");
  const shipment = findShipment(shipmentId);

  if (!shipment) {
    throw notFound(`Shipment ${shipmentId} not found`);
  }

  return c.json(shipment);
});

shipmentsRoute.post("/", async (c) => {
  const shipment = await parseJsonBody(c, SHIPMENT_SCHEMA);

  if (isShipmentIdTaken(shipment.shipment_id)) {
    throw conflict(`${shipment.shipment_id} already exists`);
  }

  const created = createShipment(shipment);

  return c.json(created, HTTP_STATUS.CREATED);
});

shipmentsRoute.delete("/:id", (c) => {
  const shipmentId = c.req.param("id");
  const isDeleted = deleteShipment(shipmentId);

  if (!isDeleted) {
    throw notFound(`Shipment ${shipmentId} not found`);
  }

  return c.body(null, HTTP_STATUS.NO_CONTENT);
});
