import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideCircleCheck, LucideCircleX, LucideX } from '@lucide/angular';
import { TOAST_TONES, ToastService } from '../core/toast';

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideCircleCheck, LucideCircleX, LucideX],
  host: { class: 'pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2' },
  styles: `
    .toast {
      animation: enter 220ms var(--ease-out-expo);
    }
    @keyframes enter {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }
  `,
  template: `
    <div aria-live="polite" class="contents">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="toast pointer-events-auto flex items-start gap-2.5 rounded-md bg-navy-950 px-3.5 py-3 text-[0.875rem] text-white shadow-[0_8px_24px_-6px_rgb(11_18_48/0.45)]"
          role="status"
        >
          @if (toast.tone === TONES.ERROR) {
            <svg lucideCircleX [size]="18" class="mt-px shrink-0 text-[var(--line-scarlet)]" aria-hidden="true"></svg>
          } @else {
            <svg lucideCircleCheck [size]="18" class="mt-px shrink-0 text-[#6fd38f]" aria-hidden="true"></svg>
          }
          <p class="min-w-0 flex-1">{{ toast.message }}</p>
          <button
            type="button"
            class="-m-1 rounded p-1 text-navy-300 hover:text-white"
            aria-label="Dismiss"
            (click)="toastService.dismiss(toast.id)"
          >
            <svg lucideX [size]="16" aria-hidden="true"></svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHost {
  protected readonly toastService = inject(ToastService);
  protected readonly TONES = TOAST_TONES;
}
