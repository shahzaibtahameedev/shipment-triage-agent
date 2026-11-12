import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideChevronRight, LucideRefreshCw } from '@lucide/angular';
import { Api, toErrorMessage } from '../../core/api';
import { CARRIER_INFO, LOG_EVENTS, LOG_LEVELS, type LogEntry, type LogEvent } from '../../core/models';
import { formatDate } from '../../core/shipment-format';
import { ActionBadge } from '../../shared/action-badge';
import { CarrierLine } from '../../shared/carrier-line';
import { JsonTree } from '../../shared/json-tree/json-tree';
import { STATUS_KINDS, StatusBadge, type StatusKind } from '../../shared/status-badge';
import { EVENT_LABELS, RUN_OUTCOMES, groupRuns, isProblem, type RunGroup, type RunOutcomeKind } from './log-runs';

const LOG_LIMIT = 2000;
const MS_PER_SECOND = 1000;
const MAX_TRAIL_STOPS = 12;
const IDLE_LINE_COLOR = 'var(--line-idle)';

const OUTCOME_BADGES: Record<RunOutcomeKind, { kind: StatusKind; label: string }> = {
  [RUN_OUTCOMES.COMPLETED]: { kind: STATUS_KINDS.COMPLETED, label: 'Completed' },
  [RUN_OUTCOMES.AWAITING]: { kind: STATUS_KINDS.AWAITING, label: 'Awaiting approval' },
  [RUN_OUTCOMES.FAILED]: { kind: STATUS_KINDS.FAILED, label: 'Failed' },
  [RUN_OUTCOMES.SKIPPED]: { kind: STATUS_KINDS.COMPLETED, label: 'Nothing to resume' },
  [RUN_OUTCOMES.OPEN]: { kind: STATUS_KINDS.RUNNING, label: 'No end recorded' },
};

const STOP_STYLES = {
  PROBLEM: 'var(--scarlet)',
  WAITING: 'var(--amber-ink)',
  END: 'var(--ink)',
} as const;

@Component({
  selector: 'app-logs-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ActionBadge, CarrierLine, JsonTree, StatusBadge, LucideChevronRight, LucideRefreshCw],
  templateUrl: './logs-page.html',
})
export class LogsPage {
  private readonly api = inject(Api);

  protected readonly EVENT_LABELS = EVENT_LABELS;
  protected readonly OUTCOME_BADGES = OUTCOME_BADGES;
  protected readonly levels = Object.values(LOG_LEVELS);
  protected readonly events = Object.values(LOG_EVENTS);
  protected readonly formatDate = formatDate;

  protected readonly logs = resource({ loader: () => this.api.listLogs({ limit: LOG_LIMIT }) });

  protected readonly shipmentFilter = signal('');
  protected readonly levelFilter = signal('');
  protected readonly eventFilter = signal('');
  protected readonly searchText = signal('');
  protected readonly expandedRuns = signal<ReadonlySet<string>>(new Set());
  protected readonly expandedData = signal<ReadonlySet<string>>(new Set());

  protected readonly allEntries = computed(() => {
    const entries = this.logs.hasValue() ? this.logs.value() : [];

    return entries;
  });

  protected readonly shipmentOptions = computed(() => {
    const ids = new Set<string>();
    for (const entry of this.allEntries()) {
      if (entry.shipmentId) {
        ids.add(entry.shipmentId);
      }
    }
    const options = Array.from(ids).sort();

    return options;
  });

  protected readonly hasFilters = computed(() => {
    const hasFilters = Boolean(this.shipmentFilter() || this.levelFilter() || this.eventFilter() || this.searchText().trim());

    return hasFilters;
  });

  protected readonly runs = computed<RunGroup[]>(() => {
    const shipmentId = this.shipmentFilter();
    const level = this.levelFilter();
    const event = this.eventFilter();
    const search = this.searchText().trim().toLowerCase();
    const filtered = this.allEntries().filter((entry) => {
      const matchesShipment = !shipmentId || entry.shipmentId === shipmentId;
      const matchesLevel = !level || entry.level === level;
      const matchesEvent = !event || entry.event === event;
      const matchesSearch = !search || entry.message.toLowerCase().includes(search);
      const matches = matchesShipment && matchesLevel && matchesEvent && matchesSearch;

      return matches;
    });
    const runs = groupRuns(filtered);

    return runs;
  });

  protected clearFilters(): void {
    this.shipmentFilter.set('');
    this.levelFilter.set('');
    this.eventFilter.set('');
    this.searchText.set('');
  }

  protected toggleRun(key: string): void {
    this.expandedRuns.set(this.toggled(this.expandedRuns(), key));
  }

  protected toggleData(key: string): void {
    this.expandedData.set(this.toggled(this.expandedData(), key));
  }

  protected entryKey(entry: LogEntry, index: number): string {
    const key = `${entry.runId ?? 'none'}-${index}`;

    return key;
  }

  protected lineColor(run: RunGroup): string {
    const color = run.carrier ? CARRIER_INFO[run.carrier].color : IDLE_LINE_COLOR;

    return color;
  }

  protected trailStops(run: RunGroup): LogEntry[] {
    const stops = run.entries.slice(0, MAX_TRAIL_STOPS);

    return stops;
  }

  protected stopColor(entry: LogEntry, run: RunGroup): string {
    if (isProblem(entry)) {
      return STOP_STYLES.PROBLEM;
    }

    switch (entry.event) {
      case LOG_EVENTS.APPROVAL_REQUESTED:
        return STOP_STYLES.WAITING;
      case LOG_EVENTS.RUN_COMPLETED:
        return STOP_STYLES.END;
      default:
        return this.lineColor(run);
    }
  }

  protected isFilledStop(event: LogEvent): boolean {
    const isFilled = event === LOG_EVENTS.RUN_COMPLETED || event === LOG_EVENTS.RUN_FAILED;

    return isFilled;
  }

  protected seconds(durationMs: number): string {
    const seconds = (Math.max(0, durationMs) / MS_PER_SECOND).toFixed(2);

    return seconds;
  }

  protected offset(entry: LogEntry, run: RunGroup): string {
    const offsetMs = Date.parse(entry.timestamp) - Date.parse(run.startedAt);
    const offset = `+${this.seconds(offsetMs)} s`;

    return offset;
  }

  protected eventLabel(event: string): string {
    const label = EVENT_LABELS[event as LogEvent] ?? event;

    return label;
  }

  protected kindLabel(kind: string): string {
    switch (kind) {
      case 'triage':
        return 'Triage';
      case 'resume':
        return 'Resume';
      default:
        return 'Outside a run';
    }
  }

  protected errorMessage(error: unknown): string {
    const message = toErrorMessage(error);

    return message;
  }

  private toggled(current: ReadonlySet<string>, key: string): ReadonlySet<string> {
    const next = new Set(current);

    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }

    return next;
  }
}
