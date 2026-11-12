import { Injectable, inject, signal } from '@angular/core';
import { Api, toErrorMessage } from './api';
import type { HumanDecision, RunOutcome } from './models';

export const RUN_PHASES = {
  IDLE: 'idle',
  RUNNING: 'running',
  DECIDING: 'deciding',
  DONE: 'done',
  FAILED: 'failed',
} as const;

export type RunPhase = (typeof RUN_PHASES)[keyof typeof RUN_PHASES];

export interface RunView {
  phase: RunPhase;
  outcome: RunOutcome | null;
  error: string | null;
  startedAt: number | null;
}

const IDLE_VIEW: RunView = { phase: RUN_PHASES.IDLE, outcome: null, error: null, startedAt: null };

// Lives at the root so a run keeps going (and its result stays) when the user leaves the page
@Injectable({ providedIn: 'root' })
export class RunStore {
  private readonly api = inject(Api);
  private readonly views = signal<ReadonlyMap<string, RunView>>(new Map());

  viewFor(shipmentId: string): RunView {
    const view = this.views().get(shipmentId) ?? IDLE_VIEW;

    return view;
  }

  async start(shipmentId: string): Promise<void> {
    this.setView(shipmentId, { phase: RUN_PHASES.RUNNING, outcome: null, error: null, startedAt: Date.now() });

    try {
      const outcome = await this.api.startRun(shipmentId);
      this.setView(shipmentId, { phase: RUN_PHASES.DONE, outcome, error: null, startedAt: null });
    } catch (error) {
      this.setView(shipmentId, { phase: RUN_PHASES.FAILED, outcome: null, error: toErrorMessage(error), startedAt: null });
    }
  }

  async decide(shipmentId: string, decision: HumanDecision): Promise<void> {
    const previous = this.viewFor(shipmentId);
    this.setView(shipmentId, { phase: RUN_PHASES.DECIDING, outcome: previous.outcome, error: null, startedAt: Date.now() });

    try {
      const outcome = await this.api.decide(shipmentId, decision);
      this.setView(shipmentId, { phase: RUN_PHASES.DONE, outcome, error: null, startedAt: null });
    } catch (error) {
      this.setView(shipmentId, {
        phase: RUN_PHASES.DONE,
        outcome: previous.outcome,
        error: toErrorMessage(error),
        startedAt: null,
      });
    }
  }

  private setView(shipmentId: string, view: RunView): void {
    const next = new Map(this.views());
    next.set(shipmentId, view);
    this.views.set(next);
  }
}
