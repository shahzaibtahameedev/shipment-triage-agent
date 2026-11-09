import { Command, INTERRUPT, isInterrupted, type StateSnapshot } from "@langchain/langgraph";
import { buildGraph } from "./graph.ts";
import { HUMAN_DECISIONS, type HumanDecision } from "./constants.ts";
import { buildEvent, type TriageStateType } from "./state.ts";
import type { ApprovalRequest, ApprovalResponse } from "./approval.ts";
import { log } from "./logger.ts";

const USAGE = `Usage:
  npm run triage -- SH-1002
  npm run resume -- SH-1002 approved|rejected`;

async function runTriage(shipmentId: string): Promise<void> {
  const event = buildEvent(shipmentId);
  const config = { configurable: { thread_id: shipmentId } };
  const { graph, checkpointer } = await buildGraph();

  try {
    const graphState = await graph.getState(config);
    const isPendingApproval = isWaitingForApproval(graphState);
    log(`Starting triage for shipment: ${shipmentId}`);

    if (isPendingApproval) {
      log(`${shipmentId} is already waiting for approval.`);
      log(formatResumeCommands(shipmentId));
      return;
    }

    const initialGraphState = { event, triage_result: null, needs_human_approval: false, human_decision: null };
    
    const result = await graph.invoke(initialGraphState, config);
    const isInterrupt = isInterrupted<ApprovalRequest>(result);

    if (isInterrupt) {
      log(`Triage for ${shipmentId} was interrupted for human input, checkpoint saved to Postgres`);
      const approvalRequest = JSON.stringify(result[INTERRUPT][0]?.value, null, 2);
      log(`Approval request ${approvalRequest}`);
      log(`${formatResumeCommands(shipmentId)}`)
      log(`${shipmentId} is waiting for human approval. Details in log.txt`);
      
      return;
    }

    log(`${shipmentId} Triage Completed`);
    log(`Final state: ${formatFinalState(result)}`)
  } finally {
    await checkpointer.end(); // close the pg pool so the process exits
  }
}

async function runResume(shipmentId: string, decision: HumanDecision): Promise<void> {
  const config = { configurable: { thread_id: shipmentId } };
  const { graph, checkpointer } = await buildGraph();
  const graphState = await graph.getState(config);
  const isPendingApproval = isWaitingForApproval(graphState);

  try {
    if (!isPendingApproval) {
      log(`Nothing to resume: ${shipmentId} is not waiting for approval.`);
      log(`Start it with: npm run triage -- ${shipmentId}`);
      return;
    }

    const resume: ApprovalResponse = { decision };
    log(`Resuming triage for shipment: ${shipmentId} with command: ${decision}`);
    const result = await graph.invoke(new Command({ resume }), config);


    log(`${shipmentId} Triage Completed`);
    log(`Final state: ${formatFinalState(result)}`)
  } finally {
    await checkpointer.end();
  }
}

function isWaitingForApproval(snapshot: StateSnapshot): boolean {
  return snapshot.tasks.some((task) => task.interrupts.length > 0);
}

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

function formatFinalState(state: TriageStateType): string {
  const finalState = {
    triage_result: state.triage_result,
    needs_human_approval: state.needs_human_approval,
    human_decision: state.human_decision,
    carrier_findings: state.carrier_findings,
  };
  return JSON.stringify(finalState, null, 2);
}

const [command, rawShipmentId, decision] = process.argv.slice(2);
const shipmentId = rawShipmentId?.trim().toUpperCase();

if (command === "triage" && shipmentId) {
  await runTriage(shipmentId);
} else if (command === "resume" && shipmentId && isHumanDecision(decision)) {
  await runResume(shipmentId, decision);
} else {
  console.error(USAGE);
  process.exitCode = 1;
}
