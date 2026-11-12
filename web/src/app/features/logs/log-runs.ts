import { LOG_EVENTS, LOG_LEVELS, isCarrier, type Carrier, type LogEntry, type LogEvent, type TriageAction } from '../../core/models';

export const RUN_OUTCOMES = {
  COMPLETED: 'completed',
  AWAITING: 'awaiting',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  OPEN: 'open',
} as const;

export type RunOutcomeKind = (typeof RUN_OUTCOMES)[keyof typeof RUN_OUTCOMES];

export interface RunGroup {
  key: string;
  shipmentId: string;
  kind: string;
  carrier: Carrier | null;
  startedAt: string;
  durationMs: number;
  outcome: RunOutcomeKind;
  action: TriageAction | null;
  entries: LogEntry[];
}

export const EVENT_LABELS: Record<LogEvent, string> = {
  [LOG_EVENTS.RUN_STARTED]: 'Run started',
  [LOG_EVENTS.ALREADY_PENDING]: 'Already waiting',
  [LOG_EVENTS.NOTHING_TO_RESUME]: 'Nothing to resume',
  [LOG_EVENTS.ROUTE_SELECTED]: 'Routed',
  [LOG_EVENTS.TOOL_CALL]: 'Tool call',
  [LOG_EVENTS.SPECIALIST_RESULT]: 'Specialist answered',
  [LOG_EVENTS.APPROVAL_REQUESTED]: 'Approval requested',
  [LOG_EVENTS.HUMAN_DECISION]: 'Human decision',
  [LOG_EVENTS.RUN_COMPLETED]: 'Completed',
  [LOG_EVENTS.RUN_FAILED]: 'Failed',
};

const NO_RUN_KEY = 'outside-a-run';
const UNKNOWN_SHIPMENT = '—';

function readField(data: unknown, field: string): unknown {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }

  const value = (data as Record<string, unknown>)[field];

  return value;
}

function findCarrier(entries: LogEntry[]): Carrier | null {
  for (const entry of entries) {
    const carrier = readField(entry.data, 'carrier');
    if (isCarrier(carrier)) {
      return carrier;
    }
  }

  return null;
}

function findAction(entries: LogEntry[]): TriageAction | null {
  let action: TriageAction | null = null;

  for (const entry of entries) {
    const triage = readField(entry.data, 'triage') ?? readField(entry.data, 'triage_result');
    const entryAction = readField(triage, 'action');
    if (typeof entryAction === 'string') {
      action = entryAction as TriageAction;
    }
  }

  return action;
}

function findOutcome(entries: LogEntry[]): RunOutcomeKind {
  const events = new Set(entries.map((entry) => entry.event));

  if (events.has(LOG_EVENTS.RUN_FAILED)) {
    return RUN_OUTCOMES.FAILED;
  }
  if (events.has(LOG_EVENTS.RUN_COMPLETED)) {
    return RUN_OUTCOMES.COMPLETED;
  }
  if (events.has(LOG_EVENTS.APPROVAL_REQUESTED) || events.has(LOG_EVENTS.ALREADY_PENDING)) {
    return RUN_OUTCOMES.AWAITING;
  }
  if (events.has(LOG_EVENTS.NOTHING_TO_RESUME)) {
    return RUN_OUTCOMES.SKIPPED;
  }

  return RUN_OUTCOMES.OPEN;
}

// Entries arrive newest first; runs keep that order, entries inside a run read oldest first
export function groupRuns(entries: LogEntry[]): RunGroup[] {
  const groups = new Map<string, LogEntry[]>();

  for (const entry of entries) {
    const key = entry.runId ?? NO_RUN_KEY;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }

  const runs = Array.from(groups.entries()).map(([key, newestFirst]) => {
    const chronological = newestFirst.slice().reverse();
    const first = chronological[0];
    const last = chronological[chronological.length - 1];
    const run: RunGroup = {
      key,
      shipmentId: first.shipmentId ?? UNKNOWN_SHIPMENT,
      kind: first.kind ?? 'other',
      carrier: findCarrier(chronological),
      startedAt: first.timestamp,
      durationMs: Date.parse(last.timestamp) - Date.parse(first.timestamp),
      outcome: findOutcome(chronological),
      action: findAction(chronological),
      entries: chronological,
    };

    return run;
  });

  return runs;
}

export function isProblem(entry: LogEntry): boolean {
  const isProblem = entry.level === LOG_LEVELS.ERROR || entry.level === LOG_LEVELS.WARN;

  return isProblem;
}
