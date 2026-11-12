import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { LucideBot, LucidePlay } from '@lucide/angular';

const TICK_MS = 100;
const MS_PER_SECOND = 1000;
const SECONDS_DECIMALS = 1;

// Four line inks, each an arc of the ring around the robot while the agent runs
const RING_SEGMENTS = [
  { color: 'var(--line-scarlet)', offset: 0 },
  { color: 'var(--line-maersk)', offset: -88 },
  { color: 'var(--line-dhl)', offset: -176 },
  { color: 'var(--line-regional)', offset: -264 },
];

@Component({
  selector: 'app-execute-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideBot, LucidePlay],
  host: { class: 'flex flex-col items-center' },
  styles: `
    .loader-ring {
      animation: spin 2800ms linear infinite;
      transform-origin: center;
    }
    .loader-bot {
      animation: bob 1400ms var(--ease-out-expo) infinite alternate;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @keyframes bob {
      to {
        transform: translateY(-2px);
      }
    }
  `,
  template: `
    <p class="mb-2 min-h-5 text-center text-[0.8125rem] text-ink-2 tabular" aria-live="polite">
      @if (running()) {
        <span class="sr-only">Agent is running.</span>
        <span aria-hidden="true">{{ statusText() }} · {{ elapsedSeconds() }} s</span>
      } @else if (hint()) {
        {{ hint() }}
      }
    </p>
    <div class="relative grid size-[120px] place-items-center">
      @if (running()) {
        <svg viewBox="0 0 120 120" class="loader-ring absolute inset-0" aria-hidden="true">
          @for (segment of segments; track segment.offset) {
            <circle
              cx="60"
              cy="60"
              r="56"
              fill="none"
              stroke-width="5"
              stroke-linecap="round"
              stroke-dasharray="66 286"
              [attr.stroke]="segment.color"
              [attr.stroke-dashoffset]="segment.offset"
            />
          }
        </svg>
      }
      <button
        type="button"
        class="group relative grid size-[104px] place-items-center rounded-full border-[6px] bg-surface text-ink transition-[border-color,transform] duration-200 ease-out-expo enabled:hover:scale-[1.03] enabled:active:scale-[0.98] disabled:cursor-not-allowed"
        [style.border-color]="ringColor()"
        [disabled]="disabled() || running()"
        [attr.aria-busy]="running()"
        (click)="execute.emit()"
      >
        <span class="flex flex-col items-center gap-0.5">
          @if (running()) {
            <svg lucideBot [size]="30" class="loader-bot" aria-hidden="true"></svg>
            <span class="label-caps text-[0.6875rem]">Running</span>
          } @else {
            <svg lucidePlay [size]="26" class="translate-x-[2px]" aria-hidden="true"></svg>
            <span class="label-caps text-[0.75rem]">Execute</span>
          }
        </span>
      </button>
    </div>
  `,
})
export class ExecuteButton {
  readonly running = input(false);
  readonly disabled = input(false);
  readonly startedAt = input<number | null>(null);
  readonly lineColor = input('var(--ink)');
  readonly statusText = input('Triaging');
  readonly hint = input('');
  readonly execute = output<void>();

  protected readonly segments = RING_SEGMENTS;
  private readonly now = signal(Date.now());

  protected readonly ringColor = computed(() => {
    const isInactive = this.disabled() && !this.running();
    const color = isInactive ? 'var(--rule-strong)' : this.lineColor();

    return color;
  });

  protected readonly elapsedSeconds = computed(() => {
    const startedAt = this.startedAt() ?? this.now();
    const seconds = Math.max(0, (this.now() - startedAt) / MS_PER_SECOND).toFixed(SECONDS_DECIMALS);

    return seconds;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    let timer: ReturnType<typeof setInterval> | undefined;

    effect(() => {
      clearInterval(timer);
      if (this.running()) {
        this.now.set(Date.now());
        timer = setInterval(() => this.now.set(Date.now()), TICK_MS);
      }
    });
    destroyRef.onDestroy(() => clearInterval(timer));
  }
}
