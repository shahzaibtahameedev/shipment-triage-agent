import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LucideTrash } from '@lucide/angular';

@Component({
  selector: 'app-delete-confirm',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideTrash],
  host: { class: 'inline-flex' },
  template: `
    @if (confirming()) {
      <span class="inline-flex flex-wrap items-center gap-2">
        <span class="text-[0.875rem] text-ink-2">{{ question() }}</span>
        <button #cancelButton type="button" class="btn btn-ghost btn-sm" (click)="confirming.set(false)">Cancel</button>
        <button type="button" class="btn btn-danger-solid btn-sm" [disabled]="busy()" (click)="confirmed.emit()">
          Delete
        </button>
      </span>
    } @else {
      <button type="button" class="btn btn-danger btn-sm" [disabled]="busy()" (click)="confirming.set(true)">
        <svg lucideTrash aria-hidden="true"></svg>
        Delete
      </button>
    }
  `,
})
export class DeleteConfirm {
  readonly question = input('Delete this?');
  readonly busy = input(false);
  readonly confirmed = output<void>();

  protected readonly confirming = signal(false);
  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');

  constructor() {
    afterRenderEffect(() => {
      this.cancelButton()?.nativeElement.focus();
    });
  }
}
