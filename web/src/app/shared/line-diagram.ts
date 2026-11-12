import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ALL_CARRIERS, CARRIER_INFO, CARRIERS, type Carrier } from '../core/models';

export const JOURNEY_PHASES = {
  IDLE: 'idle',
  RUNNING: 'running',
  DONE: 'done',
  FAILED: 'failed',
} as const;

export type JourneyPhase = (typeof JOURNEY_PHASES)[keyof typeof JOURNEY_PHASES];

export const APPROVAL_STATES = {
  UNKNOWN: 'unknown',
  SKIPPED: 'skipped',
  WAITING: 'waiting',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type ApprovalState = (typeof APPROVAL_STATES)[keyof typeof APPROVAL_STATES];

const CENTER_X = 145;
const ROUTE_Y = 24;
const SPLIT_Y = 40;
const BRANCH_TOP_Y = 110;
const STATION_Y = 130;
const BRANCH_BOTTOM_Y = 150;
const APPROVAL_Y = 220;
const DONE_Y = 284;
const BRANCH_X: Record<Carrier, number> = {
  [CARRIERS.DHL]: 75,
  [CARRIERS.MAERSK]: CENTER_X,
  [CARRIERS.REGIONAL_GROUND]: 215,
};
const LABEL_GAP = 14;
const IDLE_COLOR = 'var(--line-idle)';
const INK_COLOR = 'var(--ink)';
const SURFACE_COLOR = 'var(--surface)';
const STATION_DELAY_MS = 180;

const APPROVAL_LABELS: Record<ApprovalState, string> = {
  [APPROVAL_STATES.UNKNOWN]: '',
  [APPROVAL_STATES.SKIPPED]: 'Not needed',
  [APPROVAL_STATES.WAITING]: 'Waiting for you',
  [APPROVAL_STATES.APPROVED]: 'Approved',
  [APPROVAL_STATES.REJECTED]: 'Rejected',
};

interface Branch {
  carrier: Carrier;
  path: string;
  stationX: number;
  labelX: number;
  labelAnchor: 'start' | 'end';
  label: string;
  color: string;
  isSelected: boolean;
}

function branchPath(x: number): string {
  if (x === CENTER_X) {
    const straight = `M${CENTER_X} ${ROUTE_Y} V${APPROVAL_Y}`;

    return straight;
  }

  const bent =
    `M${CENTER_X} ${ROUTE_Y} V${SPLIT_Y} L${x} ${BRANCH_TOP_Y} ` + `V${BRANCH_BOTTOM_Y} L${CENTER_X} ${APPROVAL_Y}`;

  return bent;
}

@Component({
  selector: 'app-line-diagram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  styles: `
    .diagram-label {
      font-family: var(--font-display);
      font-weight: 600;
      font-size: 11.5px;
      letter-spacing: 0.09em;
      fill: var(--ink-2);
      transition: opacity 200ms var(--ease-out-expo);
    }
    .diagram-label-dim {
      opacity: 0.45;
    }
    .diagram-sublabel {
      font-family: var(--font-sans);
      font-size: 11.5px;
      fill: var(--ink-3);
    }
    .station {
      transition: fill 240ms var(--ease-out-expo), stroke 240ms var(--ease-out-expo);
    }
    .flow {
      stroke-dasharray: 2 12;
      animation: flow 900ms linear infinite;
    }
    .pulse {
      transform-origin: center;
      transform-box: fill-box;
      animation: pulse 1800ms var(--ease-out-expo) infinite;
    }
    @keyframes flow {
      to {
        stroke-dashoffset: -14;
      }
    }
    @keyframes pulse {
      from {
        opacity: 0.6;
        transform: scale(1);
      }
      to {
        opacity: 0;
        transform: scale(2.2);
      }
    }
  `,
  template: `
    <svg viewBox="0 0 290 300" class="mx-auto block w-full max-w-[290px]" role="img" [attr.aria-label]="summary()">
      <path [attr.d]="trunkInPath" [attr.stroke]="lineColor()" stroke-width="7" fill="none" />
      @for (branch of branches(); track branch.carrier) {
        <path
          [attr.d]="branch.path"
          [attr.stroke]="branch.color"
          [attr.stroke-opacity]="branch.isSelected || !carrier() ? 1 : 0.16"
          [attr.stroke-width]="branch.isSelected ? 7 : 5"
          stroke-linejoin="round"
          fill="none"
        />
      }
      @if (selectedBranch(); as branch) {
        @if (phase() === PHASES.RUNNING) {
          <path [attr.d]="branch.path" class="flow" stroke="white" stroke-width="2" stroke-linecap="round" fill="none" />
        }
      }
      <path [attr.d]="trunkOutPath" [attr.stroke]="lineColor()" stroke-width="7" fill="none" />

      <circle class="station" [attr.cx]="centerX" [attr.cy]="routeY" r="10" stroke-width="4"
        [attr.stroke]="ink" [attr.fill]="isVisited() ? ink : surface" />
      <text [attr.x]="centerX + labelGap + 2" [attr.y]="routeY + 4" class="diagram-label">ROUTE</text>

      @for (branch of branches(); track branch.carrier) {
        <circle
          class="station"
          [attr.cx]="branch.stationX"
          [attr.cy]="stationY"
          r="7"
          stroke-width="3.5"
          [attr.stroke]="branch.isSelected || !carrier() ? branch.color : idleColor"
          [attr.fill]="branch.isSelected && isVisited() ? branch.color : surface"
          [style.transition-delay.ms]="isVisited() ? stationDelay : 0"
        />
        <text
          [attr.x]="branch.labelX"
          [attr.y]="stationY + 4"
          [attr.text-anchor]="branch.labelAnchor"
          class="diagram-label"
          [class.diagram-label-dim]="carrier() && !branch.isSelected"
        >
          {{ branch.label }}
        </text>
      }

      @if (approval() === APPROVALS.WAITING) {
        <circle class="pulse" [attr.cx]="centerX" [attr.cy]="approvalY" r="9" fill="none" stroke="var(--amber-ink)" stroke-width="2" />
      }
      <circle
        class="station"
        [attr.cx]="centerX"
        [attr.cy]="approvalY"
        r="9"
        stroke-width="4"
        [attr.stroke]="approvalStroke()"
        [attr.stroke-dasharray]="approval() === APPROVALS.SKIPPED ? '3 3' : null"
        [attr.fill]="approvalFill()"
        [style.transition-delay.ms]="isVisited() ? stationDelay * 2 : 0"
      />
      <text [attr.x]="centerX + labelGap + 1" [attr.y]="approvalY + 4" class="diagram-label">APPROVAL</text>
      @if (approvalLabel()) {
        <text [attr.x]="centerX + labelGap + 1" [attr.y]="approvalY + 19" class="diagram-sublabel">{{ approvalLabel() }}</text>
      }

      <circle
        class="station"
        [attr.cx]="centerX"
        [attr.cy]="doneY"
        r="10"
        stroke-width="4"
        [attr.stroke]="phase() === PHASES.FAILED ? 'var(--scarlet)' : ink"
        [attr.fill]="isComplete() ? ink : surface"
        [style.transition-delay.ms]="isComplete() ? stationDelay * 3 : 0"
      />
      <text [attr.x]="centerX + labelGap + 2" [attr.y]="doneY + 4" class="diagram-label">
        {{ phase() === PHASES.FAILED ? 'FAILED' : 'DONE' }}
      </text>
    </svg>
  `,
})
export class LineDiagram {
  readonly carrier = input<Carrier | null>(null);
  readonly phase = input<JourneyPhase>(JOURNEY_PHASES.IDLE);
  readonly approval = input<ApprovalState>(APPROVAL_STATES.UNKNOWN);

  protected readonly PHASES = JOURNEY_PHASES;
  protected readonly APPROVALS = APPROVAL_STATES;
  protected readonly centerX = CENTER_X;
  protected readonly routeY = ROUTE_Y;
  protected readonly stationY = STATION_Y;
  protected readonly approvalY = APPROVAL_Y;
  protected readonly doneY = DONE_Y;
  protected readonly labelGap = LABEL_GAP;
  protected readonly ink = INK_COLOR;
  protected readonly surface = SURFACE_COLOR;
  protected readonly idleColor = IDLE_COLOR;
  protected readonly stationDelay = STATION_DELAY_MS;
  protected readonly trunkInPath = `M${CENTER_X} 0 V${ROUTE_Y}`;
  protected readonly trunkOutPath = `M${CENTER_X} ${APPROVAL_Y} V${DONE_Y}`;

  protected readonly branches = computed<Branch[]>(() => {
    const selected = this.carrier();
    const branches = ALL_CARRIERS.map((carrier) => {
      const x = BRANCH_X[carrier];
      const isLeft = x < CENTER_X;
      const branch: Branch = {
        carrier,
        path: branchPath(x),
        stationX: x,
        labelX: isLeft ? x - LABEL_GAP : x + LABEL_GAP,
        labelAnchor: isLeft ? 'end' : 'start',
        label: CARRIER_INFO[carrier].label.toUpperCase(),
        color: CARRIER_INFO[carrier].color,
        isSelected: carrier === selected,
      };

      return branch;
    });

    return branches;
  });

  protected readonly selectedBranch = computed(() => this.branches().find((branch) => branch.isSelected) ?? null);

  protected readonly lineColor = computed(() => {
    const carrier = this.carrier();
    const color = carrier ? CARRIER_INFO[carrier].color : IDLE_COLOR;

    return color;
  });

  protected readonly isVisited = computed(() => this.phase() === JOURNEY_PHASES.DONE);

  protected readonly isComplete = computed(() => {
    const approval = this.approval();
    const isComplete = this.isVisited() && approval !== APPROVAL_STATES.WAITING;

    return isComplete;
  });

  protected readonly approvalLabel = computed(() => APPROVAL_LABELS[this.approval()]);

  protected readonly approvalStroke = computed(() => {
    switch (this.approval()) {
      case APPROVAL_STATES.SKIPPED:
        return 'var(--ink-3)';
      case APPROVAL_STATES.WAITING:
        return 'var(--amber-ink)';
      case APPROVAL_STATES.REJECTED:
        return 'var(--scarlet)';
      default:
        return INK_COLOR;
    }
  });

  protected readonly approvalFill = computed(() => {
    switch (this.approval()) {
      case APPROVAL_STATES.WAITING:
        return 'var(--amber-soft)';
      case APPROVAL_STATES.APPROVED:
        return INK_COLOR;
      case APPROVAL_STATES.REJECTED:
        return 'var(--scarlet)';
      default:
        return SURFACE_COLOR;
    }
  });

  protected readonly summary = computed(() => {
    const carrier = this.carrier();
    const specialist = carrier ? `${CARRIER_INFO[carrier].specialist} specialist` : 'carrier specialist';
    const approval = this.approvalLabel() || 'approval if a reroute is recommended';
    const summary = `Agent path: route, then ${specialist}, then ${approval}, then done.`;

    return summary;
  });
}
