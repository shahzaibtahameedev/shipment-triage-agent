import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideCircleCheck, LucideMail, LucideMegaphone, LucideSplit, LucideUserSearch } from '@lucide/angular';
import { ACTION_LABELS, TRIAGE_ACTIONS, type TriageAction } from '../core/models';

@Component({
  selector: 'app-action-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideCircleCheck, LucideMail, LucideMegaphone, LucideSplit, LucideUserSearch],
  host: {
    class:
      'inline-flex items-center gap-1.5 rounded-full border border-rule-strong bg-surface px-2.5 py-0.5 text-ink whitespace-nowrap',
  },
  template: `
    @switch (action()) {
      @case (ACTIONS.NO_ACTION) {
        <svg lucideCircleCheck [size]="14" aria-hidden="true"></svg>
      }
      @case (ACTIONS.NOTIFY_CUSTOMER) {
        <svg lucideMail [size]="14" aria-hidden="true"></svg>
      }
      @case (ACTIONS.ESCALATE_CARRIER) {
        <svg lucideMegaphone [size]="14" aria-hidden="true"></svg>
      }
      @case (ACTIONS.RECOMMEND_REROUTE) {
        <svg lucideSplit [size]="14" aria-hidden="true"></svg>
      }
      @default {
        <svg lucideUserSearch [size]="14" aria-hidden="true"></svg>
      }
    }
    <span class="label-caps">{{ label() }}</span>
  `,
})
export class ActionBadge {
  readonly action = input.required<TriageAction>();

  protected readonly ACTIONS = TRIAGE_ACTIONS;
  protected readonly label = computed(() => ACTION_LABELS[this.action()] ?? this.action());
}
