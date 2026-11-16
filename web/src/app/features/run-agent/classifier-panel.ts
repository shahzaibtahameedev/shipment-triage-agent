import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideBrain, LucideFeather, LucideTriangleAlert, LucideZap } from '@lucide/angular';
import { CLASSIFIER_ROUTES, CLASSIFIER_ROUTE_LABELS, type ClassifierDecision, type ClassifierRoute } from '../../core/models';

interface RouteStyle {
  label: string;
  classes: string;
}

const ROUTE_STYLES: Record<ClassifierRoute, RouteStyle> = {
  [CLASSIFIER_ROUTES.DETERMINISTIC]: {
    label: CLASSIFIER_ROUTE_LABELS[CLASSIFIER_ROUTES.DETERMINISTIC],
    classes: 'bg-green-soft text-green-ink border-transparent',
  },
  [CLASSIFIER_ROUTES.SMALL]: {
    label: CLASSIFIER_ROUTE_LABELS[CLASSIFIER_ROUTES.SMALL],
    classes: 'bg-surface-2 text-ink-2 border-rule-strong',
  },
  [CLASSIFIER_ROUTES.STRONG]: {
    label: CLASSIFIER_ROUTE_LABELS[CLASSIFIER_ROUTES.STRONG],
    classes: 'bg-surface-2 text-ink border-rule-strong',
  },
};

const ICON_SIZE = 14;

@Component({
  selector: 'app-classifier-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideBrain, LucideFeather, LucideTriangleAlert, LucideZap],
  template: `
    @if (decision(); as classifier) {
      <section class="panel w-full" aria-labelledby="classifier-heading">
        <header class="border-b border-rule px-4 py-2.5">
          <h2 id="classifier-heading" class="label-caps text-ink-2">Classifier</h2>
        </header>

        <div class="flex flex-col gap-3 px-4 py-3.5">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 whitespace-nowrap"
              [class]="style().classes"
            >
              @switch (classifier.route) {
                @case (ROUTES.DETERMINISTIC) {
                  <svg lucideZap [size]="ICON_SIZE" aria-hidden="true"></svg>
                }
                @case (ROUTES.SMALL) {
                  <svg lucideFeather [size]="ICON_SIZE" aria-hidden="true"></svg>
                }
                @default {
                  <svg lucideBrain [size]="ICON_SIZE" aria-hidden="true"></svg>
                }
              }
              <span class="label-caps">{{ style().label }}</span>
            </span>

            @if (classifier.model) {
              <span class="rounded bg-surface-2 px-1.5 py-px font-mono text-[0.75rem] text-ink-2">
                {{ classifier.model }}
              </span>
            } @else {
              <span class="text-[0.8125rem] text-ink-3">No model call</span>
            }
          </div>

          <p class="text-[0.8125rem] text-ink-2">{{ classifier.reason }}</p>

          @if (classifier.fallback_used) {
            <p
              class="flex items-start gap-2 rounded-md bg-amber-soft px-3 py-2 text-[0.8125rem] text-amber-ink"
              role="status"
            >
              <svg lucideTriangleAlert [size]="ICON_SIZE" class="mt-0.5 shrink-0" aria-hidden="true"></svg>
              <span>
                The chosen model failed its pre-flight check, so the run switched to the backup model
                <span class="font-mono">{{ classifier.model }}</span>.
              </span>
            </p>
          }
        </div>
      </section>
    }
  `,
})
export class ClassifierPanel {
  readonly decision = input<ClassifierDecision | null>(null);

  protected readonly ROUTES = CLASSIFIER_ROUTES;
  protected readonly ICON_SIZE = ICON_SIZE;

  protected readonly style = computed(() => {
    const route = this.decision()?.route ?? CLASSIFIER_ROUTES.STRONG;
    const routeStyle = ROUTE_STYLES[route];

    return routeStyle;
  });
}
