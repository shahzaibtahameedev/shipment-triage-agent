import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { LucideBraces } from '@lucide/angular';

const JSON_INDENT = 2;
const DEFAULT_ROWS = 18;

export function parseJson(text: string): { value: unknown; error: string | null } {
  try {
    const value: unknown = JSON.parse(text);

    return { value, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return { value: null, error: message };
  }
}

@Component({
  selector: 'app-json-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideBraces],
  host: { class: 'block' },
  template: `
    <div class="mb-1.5 flex items-center justify-between gap-2">
      <label class="label-caps text-ink-2" [attr.for]="inputId()">{{ label() }}</label>
      <button type="button" class="btn btn-ghost btn-sm" (click)="format()" [disabled]="parseError() !== null">
        <svg lucideBraces aria-hidden="true"></svg>
        Format
      </button>
    </div>
    <textarea
      class="field code-field"
      spellcheck="false"
      wrap="off"
      [id]="inputId()"
      [rows]="rows()"
      [value]="text()"
      [attr.aria-invalid]="parseError() !== null"
      [attr.aria-describedby]="inputId() + '-status'"
      (input)="text.set($any($event.target).value)"
    ></textarea>
    <p
      class="mt-1.5 min-h-5 text-[0.8125rem]"
      [id]="inputId() + '-status'"
      [class.text-scarlet-ink]="parseError() !== null"
      [class.text-ink-3]="parseError() === null"
      aria-live="polite"
    >
      @if (parseError(); as error) {
        Invalid JSON: {{ error }}
      } @else {
        Valid JSON
      }
    </p>
  `,
})
export class JsonEditor {
  readonly text = model.required<string>();
  readonly label = input('JSON');
  readonly inputId = input('json-editor');
  readonly rows = input(DEFAULT_ROWS);

  protected readonly parseError = computed(() => parseJson(this.text()).error);

  protected format(): void {
    const parsed = parseJson(this.text());

    if (parsed.error === null) {
      this.text.set(JSON.stringify(parsed.value, null, JSON_INDENT));
    }
  }
}
