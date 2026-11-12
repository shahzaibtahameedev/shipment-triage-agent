import { randomUUID } from "node:crypto";
import { Command, INTERRUPT, isInterrupted, type StateSnapshot } from "@langchain/langgraph";
import type { Span } from "@opentelemetry/api";
import { buildGraph } from "./graph.ts";
import { buildEvent, type CarrierFinding, type TriageStateType } from "./state.ts";
import type { ApprovalRequest, ApprovalResponse } from "./approval.ts";
import type { HumanDecision, TriageResult } from "./constants.ts";
import { log, withRunContext, LOG_EVENTS, LOG_LEVELS, RUN_KINDS, type RunContext } from "./logger.ts";
import { withRunSpan, TRACE_ATTRIBUTES } from "./tracing.ts";

export const RUN_STATUSES = {
  COMPLETED: "completed",
  AWAITING_APPROVAL: "awaiting_approval",
} as const;

export type RunStatus = (typeof RUN_STATUSES)[keyof typeof RUN_STATUSES];

export interface FinalState {
  triage_result: TriageResult | null;
  needs_human_approval: boolean;
  human_decision: HumanDecision | null;
  carrier_findings: CarrierFinding[];
}

export interface RunOutcome {
  runId: string;
  shipmentId: string;
  status: RunStatus;
  carrier: string;
  finalState: FinalState;
  approvalRequest: ApprovalRequest | null;
  durationMs: number;
}

const POSTGRES_UNAVAILABLE_MESSAGE = "Could not connect to Postgres. Is it running? (docker compose up -d)";

// Thrown when a run can't start right now: already running, or nothing to resume
export class RunConflictError extends Error {}

type TriageGraph = Awaited<ReturnType<typeof buildGraph>>;

// A fresh triage, or a resume carrying the human's answer
type RunRequest =
  | { kind: typeof RUN_KINDS.TRIAGE }
  | { kind: typeof RUN_KINDS.RESUME; decision: HumanDecision };

let graphPromise: Promise<TriageGraph> | undefined;
const activeShipments = new Set<string>();

async function loadGraph(): Promise<TriageGraph> {
  try {
    const triageGraph = await buildGraph();

    return triageGraph;
  } catch (error) {
    graphPromise = undefined;
    throw new Error(POSTGRES_UNAVAILABLE_MESSAGE, { cause: error });
  }
}

function getGraph(): Promise<TriageGraph> {
  if (!graphPromise) {
    graphPromise = loadGraph();
  }

  return graphPromise;
}

export async function closeGraph(): Promise<void> {
  const pendingGraph = graphPromise;
  graphPromise = undefined;

  if (!pendingGraph) {
    return;
  }

  try {
    const { checkpointer } = await pendingGraph;
    await checkpointer.end();
  } catch {
    // The graph never connected, so there is nothing to close
  }
}

export async function startTriage(shipmentId: string): Promise<RunOutcome> {
  const outcome = await runExclusive(shipmentId, { kind: RUN_KINDS.TRIAGE });

  return outcome;
}

export async function resumeTriage(shipmentId: string, decision: HumanDecision): Promise<RunOutcome> {
  const outcome = await runExclusive(shipmentId, { kind: RUN_KINDS.RESUME, decision });

  return outcome;
}

// One run per shipment at a time, so two callers can't advance the same checkpoint
async function runExclusive(shipmentId: string, request: RunRequest): Promise<RunOutcome> {
  if (activeShipments.has(shipmentId)) {
    throw new RunConflictError(`${shipmentId} is already running.`);
  }

  activeShipments.add(shipmentId);
  const context: RunContext = { runId: randomUUID(), shipmentId, kind: request.kind };

  try {
    const outcome = await withRunContext(context, () => traceRun(context, request));

    return outcome;
  } finally {
    activeShipments.delete(shipmentId);
  }
}

async function traceRun(context: RunContext, request: RunRequest): Promise<RunOutcome> {
  try {
    const outcome = await withRunSpan(context.kind, context.shipmentId, (span) => execute(context, request, span));

    return outcome;
  } catch (error) {
    logRunFailure(context, error);
    throw error;
  }
}

async function execute(context: RunContext, request: RunRequest, runSpan: Span): Promise<RunOutcome> {
  if (request.kind === RUN_KINDS.RESUME) {
    const resumed = await executeResume(context, request.decision, runSpan);

    return resumed;
  }

  const triaged = await executeTriage(context, runSpan);

  return triaged;
}

async function executeTriage(context: RunContext, runSpan: Span): Promise<RunOutcome> {
  const startedAt = Date.now();
  const { shipmentId } = context;
  log({ event: LOG_EVENTS.RUN_STARTED, message: `Starting triage for shipment: ${shipmentId}` });

  const event = buildEvent(shipmentId);
  runSpan.setAttribute(TRACE_ATTRIBUTES.CARRIER, event.carrier ?? "");

  const { graph } = await getGraph();
  const config = toThreadConfig(shipmentId);
  const snapshot = await graph.getState(config);
  const pendingRequest = findPendingApproval(snapshot);

  if (pendingRequest) {
    log({
      level: LOG_LEVELS.WARN,
      event: LOG_EVENTS.ALREADY_PENDING,
      message: `${shipmentId} is already waiting for approval.`,
      data: pendingRequest,
    });
    const pendingOutcome = toOutcome(context, startedAt, snapshot.values as TriageStateType, pendingRequest);

    return pendingOutcome;
  }

  const initialState = { event, triage_result: null, needs_human_approval: false, human_decision: null };
  const result = await graph.invoke(initialState, config);
  const outcome = finishRun(context, startedAt, result);

  return outcome;
}

async function executeResume(context: RunContext, decision: HumanDecision, runSpan: Span): Promise<RunOutcome> {
  const startedAt = Date.now();
  const { shipmentId } = context;
  log({
    event: LOG_EVENTS.RUN_STARTED,
    message: `Resuming triage for shipment: ${shipmentId} with decision: ${decision}`,
    data: { decision },
  });

  const { graph } = await getGraph();
  const config = toThreadConfig(shipmentId);
  const snapshot = await graph.getState(config);
  runSpan.setAttribute(TRACE_ATTRIBUTES.CARRIER, snapshot.values.event?.carrier ?? "");

  if (!findPendingApproval(snapshot)) {
    log({
      level: LOG_LEVELS.WARN,
      event: LOG_EVENTS.NOTHING_TO_RESUME,
      message: `Nothing to resume: ${shipmentId} is not waiting for approval.`,
    });
    throw new RunConflictError(`${shipmentId} is not waiting for approval.`);
  }

  const resume: ApprovalResponse = { decision };
  const result = await graph.invoke(new Command({ resume }), config);
  const outcome = finishRun(context, startedAt, result);

  return outcome;
}

function finishRun(context: RunContext, startedAt: number, result: TriageStateType): RunOutcome {
  if (isInterrupted<ApprovalRequest>(result)) {
    const approvalRequest = result[INTERRUPT][0]?.value ?? null;
    log({
      event: LOG_EVENTS.APPROVAL_REQUESTED,
      message: `${context.shipmentId} is waiting for human approval, checkpoint saved to Postgres`,
      data: approvalRequest,
    });
    const pendingOutcome = toOutcome(context, startedAt, result, approvalRequest);

    return pendingOutcome;
  }

  const outcome = toOutcome(context, startedAt, result, null);
  log({ event: LOG_EVENTS.RUN_COMPLETED, message: `${context.shipmentId} Triage Completed`, data: outcome.finalState });

  return outcome;
}

function logRunFailure(context: RunContext, error: unknown): void {
  if (error instanceof RunConflictError) {
    return;
  }

  const message = describeError(error);
  log({
    level: LOG_LEVELS.ERROR,
    event: LOG_EVENTS.RUN_FAILED,
    message: `${context.shipmentId} failed: ${message}`,
    data: { error: message },
  });
}

function toOutcome(
  context: RunContext,
  startedAt: number,
  values: TriageStateType,
  approvalRequest: ApprovalRequest | null,
): RunOutcome {
  const status = approvalRequest ? RUN_STATUSES.AWAITING_APPROVAL : RUN_STATUSES.COMPLETED;
  const outcome: RunOutcome = {
    runId: context.runId,
    shipmentId: context.shipmentId,
    status,
    carrier: values.event?.carrier ?? "",
    finalState: toFinalState(values),
    approvalRequest,
    durationMs: Date.now() - startedAt,
  };

  return outcome;
}

function toFinalState(values: TriageStateType): FinalState {
  const finalState: FinalState = {
    triage_result: values.triage_result ?? null,
    needs_human_approval: values.needs_human_approval ?? false,
    human_decision: values.human_decision ?? null,
    carrier_findings: values.carrier_findings ?? [],
  };

  return finalState;
}

function findPendingApproval(snapshot: StateSnapshot): ApprovalRequest | null {
  const pendingInterrupt = snapshot.tasks.flatMap((task) => task.interrupts)[0];
  const request = (pendingInterrupt?.value as ApprovalRequest | undefined) ?? null;

  return request;
}

// Some errors (e.g. pg's AggregateError) have an empty message, so fall back to the name
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const description = error.message || error.name;

  return description;
}

function toThreadConfig(shipmentId: string) {
  const config = { configurable: { thread_id: shipmentId } };

  return config;
}
