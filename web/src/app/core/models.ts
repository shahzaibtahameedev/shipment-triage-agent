export const CARRIERS = {
  DHL: 'dhl',
  MAERSK: 'maersk',
  REGIONAL_GROUND: 'regional_ground',
} as const;

export type Carrier = (typeof CARRIERS)[keyof typeof CARRIERS];

export const TRIAGE_ACTIONS = {
  NO_ACTION: 'no_action',
  NOTIFY_CUSTOMER: 'notify_customer',
  ESCALATE_CARRIER: 'escalate_carrier',
  RECOMMEND_REROUTE: 'recommend_reroute',
  NEEDS_HUMAN_REVIEW: 'needs_human_review',
} as const;

export type TriageAction = (typeof TRIAGE_ACTIONS)[keyof typeof TRIAGE_ACTIONS];

export const HUMAN_DECISIONS = {
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type HumanDecision = (typeof HUMAN_DECISIONS)[keyof typeof HUMAN_DECISIONS];

export const RUN_STATUSES = {
  COMPLETED: 'completed',
  AWAITING_APPROVAL: 'awaiting_approval',
} as const;

export type RunStatus = (typeof RUN_STATUSES)[keyof typeof RUN_STATUSES];

export const LOG_LEVELS = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
} as const;

export type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

export const LOG_EVENTS = {
  RUN_STARTED: 'run_started',
  ALREADY_PENDING: 'already_pending',
  NOTHING_TO_RESUME: 'nothing_to_resume',
  ROUTE_SELECTED: 'route_selected',
  TOOL_CALL: 'tool_call',
  SPECIALIST_RESULT: 'specialist_result',
  APPROVAL_REQUESTED: 'approval_requested',
  HUMAN_DECISION: 'human_decision',
  RUN_COMPLETED: 'run_completed',
  RUN_FAILED: 'run_failed',
} as const;

export type LogEvent = (typeof LOG_EVENTS)[keyof typeof LOG_EVENTS];

export const PROMPT_GROUPS = {
  SYSTEM: 'system',
  MESSAGE: 'message',
  TOOL: 'tool',
} as const;

export type PromptGroup = (typeof PROMPT_GROUPS)[keyof typeof PROMPT_GROUPS];

export interface Scan {
  code: string;
  location: string;
  timestamp: string;
  note?: string;
}

export interface Shipment {
  shipment_id: string;
  carrier: Carrier;
  scans: Scan[];
  mode?: string;
  origin?: string;
  destination?: string;
  customer?: string;
  cargo?: string;
  promised_delivery?: string;
  [field: string]: unknown;
}

export interface ExpectedResult {
  false_positive: boolean | null;
  actions: TriageAction[];
  notes: string;
}

export interface TestShipment {
  shipment: Shipment;
  expected: ExpectedResult;
}

export interface TriageResult {
  false_positive: boolean;
  confidence: number;
  action: TriageAction;
  reasoning: string;
}

export interface CarrierFinding {
  carrier: Carrier;
  action: TriageAction;
  confidence: number;
}

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
  approvalRequest: { triage_result: TriageResult } | null;
  durationMs: number;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: LogEvent;
  message: string;
  runId?: string;
  shipmentId?: string;
  kind?: 'triage' | 'resume';
  data?: unknown;
}

export interface PromptView {
  key: string;
  label: string;
  group: PromptGroup;
  description: string;
  placeholders: string[];
  content: string;
  defaultContent: string;
  isModified: boolean;
}

export interface ApiErrorBody {
  error: string;
  details: string[];
}

export interface CarrierInfo {
  label: string;
  specialist: string;
  color: string;
}

export const CARRIER_INFO: Record<Carrier, CarrierInfo> = {
  [CARRIERS.DHL]: { label: 'DHL', specialist: 'DHL air', color: 'var(--line-dhl)' },
  [CARRIERS.MAERSK]: { label: 'Maersk', specialist: 'Maersk ocean', color: 'var(--line-maersk)' },
  [CARRIERS.REGIONAL_GROUND]: { label: 'Regional', specialist: 'Regional ground', color: 'var(--line-regional)' },
};

export const ACTION_LABELS: Record<TriageAction, string> = {
  [TRIAGE_ACTIONS.NO_ACTION]: 'No action',
  [TRIAGE_ACTIONS.NOTIFY_CUSTOMER]: 'Notify customer',
  [TRIAGE_ACTIONS.ESCALATE_CARRIER]: 'Escalate to carrier',
  [TRIAGE_ACTIONS.RECOMMEND_REROUTE]: 'Recommend reroute',
  [TRIAGE_ACTIONS.NEEDS_HUMAN_REVIEW]: 'Needs human review',
};

export const ALL_CARRIERS = Object.values(CARRIERS);
export const ALL_ACTIONS = Object.values(TRIAGE_ACTIONS);

export function isCarrier(value: unknown): value is Carrier {
  const isKnown = (ALL_CARRIERS as unknown[]).includes(value);

  return isKnown;
}
