import { describe, expect, it } from "vitest";
import { TRIAGE_ACTIONS, TRIAGE_RESULT_SCHEMA } from "../../app/constants.ts";

const VALID_RESULT = {
  false_positive: true,
  confidence: 0.9,
  action: TRIAGE_ACTIONS.NO_ACTION,
  reasoning: "Customs hold falls on a public holiday in the destination country.",
};

const UNKNOWN_ACTION = "teleport_package";
const CONFIDENCE_ABOVE_MAX = 1.5;

describe("TRIAGE_RESULT_SCHEMA", () => {
  it("accepts a valid triage result", () => {
    const parsed = TRIAGE_RESULT_SCHEMA.safeParse(VALID_RESULT);

    expect(parsed.success).toBe(true);
  });

  it("rejects an action outside TRIAGE_ACTIONS", () => {
    const badAction = Object.assign({}, VALID_RESULT, { action: UNKNOWN_ACTION });
    const parsed = TRIAGE_RESULT_SCHEMA.safeParse(badAction);

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["action"]);
  });

  it("rejects a confidence above 1", () => {
    const badConfidence = Object.assign({}, VALID_RESULT, { confidence: CONFIDENCE_ABOVE_MAX });
    const parsed = TRIAGE_RESULT_SCHEMA.safeParse(badConfidence);

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["confidence"]);
  });

  it("rejects a result with a missing field", () => {
    const missingReasoning = {
      false_positive: VALID_RESULT.false_positive,
      confidence: VALID_RESULT.confidence,
      action: VALID_RESULT.action,
    };
    const parsed = TRIAGE_RESULT_SCHEMA.safeParse(missingReasoning);

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["reasoning"]);
  });
});
