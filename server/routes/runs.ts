import { Hono } from "hono";
import { normalizeShipmentId } from "../../stores/json-file.ts";
import { DECISION_SCHEMA, START_RUN_SCHEMA } from "../../stores/schemas.ts";
import { findShipmentForAgent } from "../../stores/shipment-lookup.ts";
import { resumeTriage, startTriage } from "../../triage-runner.ts";
import { notFound, parseJsonBody } from "../http.ts";

export const runsRoute = new Hono();

runsRoute.post("/", async (c) => {
  const { shipmentId } = await parseJsonBody(c, START_RUN_SCHEMA);

  if (!findShipmentForAgent(shipmentId)) {
    throw notFound(`Shipment ${shipmentId} not found`);
  }

  const outcome = await startTriage(shipmentId);

  return c.json(outcome);
});

runsRoute.post("/:shipmentId/decision", async (c) => {
  const shipmentId = normalizeShipmentId(c.req.param("shipmentId"));
  const { decision } = await parseJsonBody(c, DECISION_SCHEMA);
  const outcome = await resumeTriage(shipmentId, decision);

  return c.json(outcome);
});
