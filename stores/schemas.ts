import { z } from "zod";
import { CARRIERS, HUMAN_DECISIONS, SHIPMENT_ID_PATTERN, TRIAGE_ACTIONS } from "../constants.ts";

const SHIPMENT_ID_MESSAGE = "Use the format SH-1234";

export const SHIPMENT_ID_SCHEMA = z.string().trim().toUpperCase().regex(SHIPMENT_ID_PATTERN, SHIPMENT_ID_MESSAGE);

const SCAN_SCHEMA = z.looseObject({
  code: z.string().min(1),
  location: z.string(),
  timestamp: z.string(),
  note: z.string().optional(),
});

export const SHIPMENT_SCHEMA = z.looseObject({
  shipment_id: SHIPMENT_ID_SCHEMA,
  carrier: z.enum(CARRIERS),
  scans: z.array(SCAN_SCHEMA).min(1, "A shipment needs at least one scan"),
});

export const EXPECTED_RESULT_SCHEMA = z.object({
  false_positive: z.boolean().nullable(),
  actions: z.array(z.enum(TRIAGE_ACTIONS)),
  notes: z.string(),
});

export const TEST_SHIPMENT_SCHEMA = z.object({
  shipment: SHIPMENT_SCHEMA,
  expected: EXPECTED_RESULT_SCHEMA,
});

export const START_RUN_SCHEMA = z.object({
  shipmentId: SHIPMENT_ID_SCHEMA,
});

export const DECISION_SCHEMA = z.object({
  decision: z.enum(HUMAN_DECISIONS),
});

export const PROMPT_UPDATE_SCHEMA = z.object({
  content: z.string().trim().min(1, "Prompt cannot be empty"),
});

export type Shipment = z.infer<typeof SHIPMENT_SCHEMA>;
export type ExpectedResult = z.infer<typeof EXPECTED_RESULT_SCHEMA>;
export type TestShipment = z.infer<typeof TEST_SHIPMENT_SCHEMA>;
