import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideCircleCheck, LucideCircleX, LucideHand, LucideLoaderCircle } from '@lucide/angular';

export const STATUS_KINDS = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  AWAITING: 'awaiting',
  FAILED: 'failed',
} as const;

export type StatusKind = (typeof STATUS_KINDS)[keyof typeof STATUS_KINDS];

const STATUS_STYLES: Record<StatusKind, { label: string; classes: string }> = {
  [STATUS_KINDS.RUNNING]: { label: 'Running', classes: 'bg-surface-2 text-ink-2 border-rule-strong' },
  [STATUS_KINDS.COMPLETED]: { label: 'Completed', classes: 'bg-surface-2 text-ink border-rule-strong' },
  [STATUS_KINDS.AWAITING]: { label: 'Awaiting approval', classes: 'bg-amber-soft text-amber-ink border-transparent' },
  [STATUS_KINDS.FAILED]: { label: 'Failed', classes: 'bg-scarlet-soft text-scarlet-ink border-transparent' },
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideCircleCheck, LucideCircleX, LucideHand, LucideLoaderCircle],
  host: {
    class: 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 whitespace-nowrap',
    '[class]': 'style().classes',
  },
  template: `
    @switch (kind()) {
      @case (KINDS.RUNNING) {
        <svg lucideLoaderCircle [size]="14" class="animate-spin" aria-hidden="true"></svg>
      }
      @case (KINDS.AWAITING) {
        <svg lucideHand [size]="14" aria-hidden="true"></svg>
      }
      @case (KINDS.FAILED) {
        <svg lucideCircleX [size]="14" aria-hidden="true"></svg>
      }
      @default {
        <svg lucideCircleCheck [size]="14" aria-hidden="true"></svg>
      }
    }
    <span class="label-caps">{{ label() || style().label }}</span>
  `,
})
export class StatusBadge {
  readonly kind = input.required<StatusKind>();
  readonly label = input<string>('');

  protected readonly KINDS = STATUS_KINDS;
  protected readonly style = computed(() => STATUS_STYLES[this.kind()]);
}
