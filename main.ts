import { HUMAN_DECISIONS, type HumanDecision } from "./constants.ts";
import { startTracing, stopTracing } from "./tracing.ts";
import { closeGraph, resumeTriage, startTriage, RunConflictError, RUN_STATUSES, type RunOutcome } from "./triage-runner.ts";

const USAGE = `Usage:
  npm run triage -- SH-1002
  npm run resume -- SH-1002 approved|rejected`;

function isHumanDecision(value: string | undefined): value is HumanDecision {
  return (Object.values(HUMAN_DECISIONS) as (string | undefined)[]).includes(value);
}

function formatResumeCommands(shipmentId: string): string {
  return (
    `Resume from any terminal (a new process is fine):\n` +
    `  npm run resume -- ${shipmentId} approved\n` +
    `  npm run resume -- ${shipmentId} rejected`
  );
}

function printOutcome(outcome: RunOutcome): void {
  if (outcome.status === RUN_STATUSES.AWAITING_APPROVAL) {
    console.log(`Approval request ${JSON.stringify(outcome.approvalRequest, null, 2)}`);
    console.log(formatResumeCommands(outcome.shipmentId));

    return;
  }

  console.log(`Final state: ${JSON.stringify(outcome.finalState, null, 2)}`);
}

const [command, rawShipmentId, decision] = process.argv.slice(2);
const shipmentId = rawShipmentId?.trim().toUpperCase();

startTracing();
try {
  if (command === "triage" && shipmentId) {
    const outcome = await startTriage(shipmentId);
    printOutcome(outcome);
  } else if (command === "resume" && shipmentId && isHumanDecision(decision)) {
    const outcome = await resumeTriage(shipmentId, decision);
    printOutcome(outcome);
  } else {
    console.error(USAGE);
    process.exitCode = 1;
  }
} catch (error) {
  if (!(error instanceof RunConflictError)) {
    throw error;
  }
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await closeGraph();
  await stopTracing();
}
