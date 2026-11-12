import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  LucideCheck,
  LucideChevronRight,
  LucideCopy,
  LucideFileSpreadsheet,
  LucideFileText,
  LucideHand,
  LucideRotateCcw,
  LucideThumbsDown,
  LucideThumbsUp,
  LucideX,
} from '@lucide/angular';
import { RUN_PHASES, type RunView } from '../../core/run-store';
import {
  ACTION_LABELS,
  CARRIER_INFO,
  HUMAN_DECISIONS,
  RUN_STATUSES,
  isCarrier,
  type ExpectedResult,
  type HumanDecision,
  type TriageResult,
} from '../../core/models';
import { ActionBadge } from '../../shared/action-badge';
import { CarrierLine } from '../../shared/carrier-line';
import { STATUS_KINDS, StatusBadge, type StatusKind } from '../../shared/status-badge';

interface ExpectationCheck {
  label: string;
  expected: string;
  actual: string;
  passed: boolean | null;
}

const PERCENT = 100;
const MS_PER_SECOND = 1000;
const ANY_VALUE = 'Either';
const ACTION_SEPARATOR = ' or ';

function yesNo(value: boolean): string {
  const text = value ? 'Yes' : 'No';

  return text;
}

@Component({
  selector: 'app-result-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBadge,
    CarrierLine,
    StatusBadge,
    LucideCheck,
    LucideChevronRight,
    LucideCopy,
    LucideFileSpreadsheet,
    LucideFileText,
    LucideHand,
    LucideRotateCcw,
    LucideThumbsDown,
    LucideThumbsUp,
    LucideX,
  ],
  host: { class: 'flex flex-col' },
  templateUrl: './result-panel.html',
})
export class ResultPanel {
  readonly view = input<RunView | null>(null);
  readonly expected = input<ExpectedResult | null>(null);
  readonly hasShipment = input(false);
  readonly decide = output<HumanDecision>();
  readonly retry = output<void>();
  readonly copy = output<void>();

  protected readonly PHASES = RUN_PHASES;
  protected readonly KINDS = STATUS_KINDS;
  protected readonly DECISIONS = HUMAN_DECISIONS;
  protected readonly ACTION_LABELS = ACTION_LABELS;

  protected readonly outcome = computed(() => this.view()?.outcome ?? null);
  protected readonly phase = computed(() => this.view()?.phase ?? RUN_PHASES.IDLE);
  protected readonly triage = computed<TriageResult | null>(() => this.outcome()?.finalState.triage_result ?? null);
  protected readonly isAwaiting = computed(() => this.outcome()?.status === RUN_STATUSES.AWAITING_APPROVAL);
  protected readonly isDeciding = computed(() => this.phase() === RUN_PHASES.DECIDING);
  protected readonly humanDecision = computed(() => this.outcome()?.finalState.human_decision ?? null);
  protected readonly findings = computed(() => this.outcome()?.finalState.carrier_findings ?? []);

  protected readonly statusKind = computed<StatusKind>(() => {
    if (this.isAwaiting()) {
      return STATUS_KINDS.AWAITING;
    }

    return STATUS_KINDS.COMPLETED;
  });

  protected readonly specialistName = computed(() => {
    const carrier = this.outcome()?.carrier;
    const name = isCarrier(carrier) ? CARRIER_INFO[carrier].specialist : 'carrier';

    return name;
  });

  protected readonly confidencePercent = computed(() => Math.round((this.triage()?.confidence ?? 0) * PERCENT));

  protected readonly durationSeconds = computed(() => {
    const durationMs = this.outcome()?.durationMs ?? 0;
    const seconds = (durationMs / MS_PER_SECOND).toFixed(1);

    return seconds;
  });

  protected readonly checks = computed<ExpectationCheck[]>(() => {
    const expected = this.expected();
    const triage = this.triage();

    if (!expected || !triage) {
      return [];
    }

    const falsePositiveCheck: ExpectationCheck = {
      label: 'False positive',
      expected: expected.false_positive === null ? ANY_VALUE : yesNo(expected.false_positive),
      actual: yesNo(triage.false_positive),
      passed: expected.false_positive === null ? null : expected.false_positive === triage.false_positive,
    };
    const hasExpectedActions = expected.actions.length > 0;
    const actionCheck: ExpectationCheck = {
      label: 'Action',
      expected: hasExpectedActions
        ? expected.actions.map((action) => ACTION_LABELS[action]).join(ACTION_SEPARATOR)
        : ANY_VALUE,
      actual: ACTION_LABELS[triage.action],
      passed: hasExpectedActions ? expected.actions.includes(triage.action) : null,
    };
    const checks = [falsePositiveCheck, actionCheck];

    return checks;
  });

  protected readonly checksPassed = computed(() => {
    const scored = this.checks().filter((check) => check.passed !== null);
    const passed = scored.every((check) => check.passed === true);

    return passed;
  });
}
