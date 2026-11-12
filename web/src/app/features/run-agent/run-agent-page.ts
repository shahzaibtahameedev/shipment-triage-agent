import { ChangeDetectionStrategy, Component, computed, inject, input, resource } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, toErrorMessage } from '../../core/api';
import {
  CARRIER_INFO,
  HUMAN_DECISIONS,
  RUN_STATUSES,
  isCarrier,
  type ExpectedResult,
  type HumanDecision,
  type Shipment,
} from '../../core/models';
import { RUN_PHASES, RunStore } from '../../core/run-store';
import { formatDate, lastScan, routeLabel } from '../../core/shipment-format';
import { ToastService } from '../../core/toast';
import { CarrierLine } from '../../shared/carrier-line';
import { ExecuteButton } from '../../shared/execute-button';
import { JsonTree } from '../../shared/json-tree/json-tree';
import { APPROVAL_STATES, JOURNEY_PHASES, LineDiagram, type ApprovalState, type JourneyPhase } from '../../shared/line-diagram';
import { ResultPanel } from './result-panel';

const SOURCES = {
  SHIPMENT: 'shipment',
  TEST: 'test',
} as const;

type Source = (typeof SOURCES)[keyof typeof SOURCES];

const KEY_SEPARATOR = ':';
const JSON_INDENT = 2;
const IDLE_LINE_COLOR = 'var(--ink)';

interface Selection {
  source: Source;
  id: string;
}

interface SelectedShipment {
  shipment: Shipment;
  expected: ExpectedResult | null;
}

@Component({
  selector: 'app-run-agent-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CarrierLine, ExecuteButton, JsonTree, LineDiagram, ResultPanel],
  templateUrl: './run-agent-page.html',
})
export class RunAgentPage {
  readonly shipment = input<string>();
  readonly test = input<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly runStore = inject(RunStore);
  private readonly toast = inject(ToastService);

  protected readonly SOURCES = SOURCES;
  protected readonly KEY_SEPARATOR = KEY_SEPARATOR;
  protected readonly formatDate = formatDate;
  protected readonly lastScan = lastScan;
  protected readonly routeLabel = routeLabel;

  protected readonly lists = resource({
    loader: async () => {
      const [shipments, testShipments] = await Promise.all([this.api.listShipments(), this.api.listTestShipments()]);
      const lists = { shipments, testShipments };

      return lists;
    },
  });

  protected readonly selection = computed<Selection | null>(() => {
    const testId = this.test();
    const shipmentId = this.shipment();

    if (testId) {
      return { source: SOURCES.TEST, id: testId.toUpperCase() };
    }
    if (shipmentId) {
      return { source: SOURCES.SHIPMENT, id: shipmentId.toUpperCase() };
    }

    return null;
  });

  protected readonly selectionKey = computed(() => {
    const selection = this.selection();
    const key = selection ? `${selection.source}${KEY_SEPARATOR}${selection.id}` : '';

    return key;
  });

  protected readonly selected = resource({
    params: () => this.selection() ?? undefined,
    loader: async ({ params }): Promise<SelectedShipment> => {
      if (params.source === SOURCES.TEST) {
        const testShipment = await this.api.getTestShipment(params.id);
        const selectedTest = { shipment: testShipment.shipment, expected: testShipment.expected };

        return selectedTest;
      }

      const shipment = await this.api.getShipment(params.id);
      const selectedShipment = { shipment, expected: null };

      return selectedShipment;
    },
  });

  protected readonly selectedShipment = computed(() => {
    const shipment = this.selected.hasValue() ? this.selected.value().shipment : null;

    return shipment;
  });

  protected readonly carrier = computed(() => {
    const carrier = this.selectedShipment()?.carrier;
    const knownCarrier = isCarrier(carrier) ? carrier : null;

    return knownCarrier;
  });

  protected readonly lineColor = computed(() => {
    const carrier = this.carrier();
    const color = carrier ? CARRIER_INFO[carrier].color : IDLE_LINE_COLOR;

    return color;
  });

  protected readonly runView = computed(() => {
    const selection = this.selection();
    const view = selection ? this.runStore.viewFor(selection.id) : null;

    return view;
  });

  protected readonly isRunning = computed(() => {
    const phase = this.runView()?.phase;
    const isRunning = phase === RUN_PHASES.RUNNING || phase === RUN_PHASES.DECIDING;

    return isRunning;
  });

  protected readonly journeyPhase = computed<JourneyPhase>(() => {
    const view = this.runView();

    switch (view?.phase) {
      case RUN_PHASES.RUNNING:
        return JOURNEY_PHASES.RUNNING;
      case RUN_PHASES.FAILED:
        return JOURNEY_PHASES.FAILED;
      case RUN_PHASES.DONE:
      case RUN_PHASES.DECIDING:
        return view.outcome ? JOURNEY_PHASES.DONE : JOURNEY_PHASES.IDLE;
      default:
        return JOURNEY_PHASES.IDLE;
    }
  });

  protected readonly approvalState = computed<ApprovalState>(() => {
    const outcome = this.runView()?.outcome;

    if (!outcome) {
      return APPROVAL_STATES.UNKNOWN;
    }
    if (outcome.status === RUN_STATUSES.AWAITING_APPROVAL) {
      return APPROVAL_STATES.WAITING;
    }

    switch (outcome.finalState.human_decision) {
      case HUMAN_DECISIONS.APPROVED:
        return APPROVAL_STATES.APPROVED;
      case HUMAN_DECISIONS.REJECTED:
        return APPROVAL_STATES.REJECTED;
      default:
        return APPROVAL_STATES.SKIPPED;
    }
  });

  protected readonly executeHint = computed(() => {
    const shipment = this.selectedShipment();
    const hint = shipment ? `Send ${shipment.shipment_id} down the ${CARRIER_INFO[shipment.carrier]?.label ?? ''} line` : 'Choose a shipment first';

    return hint;
  });

  protected readonly executeStatus = computed(() => {
    const isDeciding = this.runView()?.phase === RUN_PHASES.DECIDING;
    const status = isDeciding ? 'Applying decision' : `Triaging ${this.selection()?.id ?? ''}`;

    return status;
  });

  protected selectFromKey(key: string): void {
    const [source, id] = key.split(KEY_SEPARATOR);
    const queryParams = source === SOURCES.TEST ? { test: id } : { shipment: id };
    void this.router.navigate([], { queryParams });
  }

  protected execute(): void {
    const selection = this.selection();

    if (selection) {
      void this.runStore.start(selection.id);
    }
  }

  protected decide(decision: HumanDecision): void {
    const selection = this.selection();

    if (selection) {
      void this.runStore.decide(selection.id, decision);
    }
  }

  protected async copyResult(): Promise<void> {
    const outcome = this.runView()?.outcome;

    if (!outcome) {
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(outcome, null, JSON_INDENT));
      this.toast.success('Result copied to the clipboard');
    } catch (error) {
      this.toast.error(`Couldn't copy: ${toErrorMessage(error)}`);
    }
  }

  protected errorMessage(error: unknown): string {
    const message = toErrorMessage(error);

    return message;
  }
}
