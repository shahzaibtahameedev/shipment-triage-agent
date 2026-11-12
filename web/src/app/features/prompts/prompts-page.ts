import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { LucideRotateCcw, LucideSave, LucideTriangleExclamationPoint } from '@lucide/angular';
import { Api, toErrorMessage } from '../../core/api';
import { PROMPT_GROUPS, type PromptGroup, type PromptView } from '../../core/models';
import { ToastService } from '../../core/toast';

interface PromptSection {
  group: PromptGroup;
  title: string;
  prompts: PromptView[];
}

const GROUP_TITLES: Record<PromptGroup, string> = {
  [PROMPT_GROUPS.SYSTEM]: 'System prompts',
  [PROMPT_GROUPS.MESSAGE]: 'Messages',
  [PROMPT_GROUPS.TOOL]: 'Tool descriptions',
};

const GROUP_ORDER: PromptGroup[] = [PROMPT_GROUPS.SYSTEM, PROMPT_GROUPS.MESSAGE, PROMPT_GROUPS.TOOL];
const EDITOR_ROWS = 22;

function placeholderToken(name: string): string {
  const token = `{{${name}}}`;

  return token;
}

@Component({
  selector: 'app-prompts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideRotateCcw, LucideSave, LucideTriangleExclamationPoint],
  host: { '(window:beforeunload)': 'warnBeforeUnload($event)' },
  templateUrl: './prompts-page.html',
})
export class PromptsPage {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);

  protected readonly editorRows = EDITOR_ROWS;
  protected readonly placeholderToken = placeholderToken;

  protected readonly prompts = resource({ loader: () => this.api.listPrompts() });
  protected readonly selectedKey = signal<string | null>(null);
  protected readonly pendingKey = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly list = computed(() => {
    const list = this.prompts.hasValue() ? this.prompts.value() : [];

    return list;
  });

  protected readonly sections = computed<PromptSection[]>(() => {
    const sections = GROUP_ORDER.map((group) => ({
      group,
      title: GROUP_TITLES[group],
      prompts: this.list().filter((prompt) => prompt.group === group),
    })).filter((section) => section.prompts.length > 0);

    return sections;
  });

  protected readonly active = computed(() => {
    const key = this.selectedKey() ?? this.list()[0]?.key;
    const prompt = this.list().find((item) => item.key === key) ?? null;

    return prompt;
  });

  protected readonly draft = linkedSignal(() => this.active()?.content ?? '');

  protected readonly isDirty = computed(() => {
    const active = this.active();
    const isDirty = active !== null && this.draft() !== active.content;

    return isDirty;
  });

  protected readonly missingPlaceholders = computed(() => {
    const active = this.active();
    const draft = this.draft();
    const missing = (active?.placeholders ?? []).filter((name) => !draft.includes(placeholderToken(name)));

    return missing;
  });

  protected readonly pendingLabel = computed(() => {
    const pendingKey = this.pendingKey();
    const label = this.list().find((item) => item.key === pendingKey)?.label ?? '';

    return label;
  });

  protected choose(key: string): void {
    if (key === this.active()?.key) {
      return;
    }

    if (this.isDirty()) {
      this.pendingKey.set(key);

      return;
    }

    this.selectedKey.set(key);
  }

  protected discardAndSwitch(): void {
    this.selectedKey.set(this.pendingKey());
    this.pendingKey.set(null);
  }

  protected revert(): void {
    this.draft.set(this.active()?.content ?? '');
  }

  protected async save(): Promise<void> {
    const active = this.active();

    if (!active) {
      return;
    }

    this.saving.set(true);

    try {
      const saved = await this.api.savePrompt(active.key, this.draft());
      this.replacePrompt(saved);
      this.toast.success(`${saved.label} saved. The next run uses it.`);
    } catch (error) {
      this.toast.error(`Couldn't save: ${toErrorMessage(error)}`);
    } finally {
      this.saving.set(false);
    }
  }

  protected async resetToDefault(): Promise<void> {
    const active = this.active();

    if (!active) {
      return;
    }

    this.saving.set(true);

    try {
      const reset = await this.api.resetPrompt(active.key);
      this.replacePrompt(reset);
      this.toast.success(`${reset.label} is back to the default`);
    } catch (error) {
      this.toast.error(`Couldn't reset: ${toErrorMessage(error)}`);
    } finally {
      this.saving.set(false);
    }
  }

  canLeave(): boolean {
    if (!this.isDirty()) {
      return true;
    }

    const canLeave = window.confirm('You have unsaved prompt changes. Leave and discard them?');

    return canLeave;
  }

  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isDirty()) {
      event.preventDefault();
    }
  }

  protected errorMessage(error: unknown): string {
    const message = toErrorMessage(error);

    return message;
  }

  private replacePrompt(updated: PromptView): void {
    this.prompts.update((prompts) => (prompts ?? []).map((prompt) => (prompt.key === updated.key ? updated : prompt)));
  }
}
