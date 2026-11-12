import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { LucideChevronRight } from '@lucide/angular';

export interface TreeCommand {
  expand: boolean;
  version: number;
}

interface TreeEntry {
  key: string;
  value: unknown;
}

const VALUE_KINDS = {
  OBJECT: 'object',
  ARRAY: 'array',
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  NULL: 'null',
} as const;

type ValueKind = (typeof VALUE_KINDS)[keyof typeof VALUE_KINDS];

const PREVIEW_PARTS = 2;
const PREVIEW_SEPARATOR = ' · ';
const PREVIEW_MAX_LENGTH = 60;
const ELLIPSIS = '…';

function kindOf(value: unknown): ValueKind {
  if (value === null || value === undefined) {
    return VALUE_KINDS.NULL;
  }
  if (Array.isArray(value)) {
    return VALUE_KINDS.ARRAY;
  }

  switch (typeof value) {
    case 'object':
      return VALUE_KINDS.OBJECT;
    case 'number':
      return VALUE_KINDS.NUMBER;
    case 'boolean':
      return VALUE_KINDS.BOOLEAN;
    default:
      return VALUE_KINDS.STRING;
  }
}

function truncate(text: string): string {
  const truncated = text.length > PREVIEW_MAX_LENGTH ? `${text.slice(0, PREVIEW_MAX_LENGTH)}${ELLIPSIS}` : text;

  return truncated;
}

@Component({
  selector: 'li[appJsonNode]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideChevronRight],
  host: {
    role: 'treeitem',
    '[attr.aria-expanded]': 'isContainer() ? expanded() : null',
  },
  template: `
    @if (isContainer()) {
      <div class="flex min-w-0 items-baseline gap-1.5 rounded px-1 py-[3px] hover:bg-surface-2">
        <button
          type="button"
          class="-ml-1 inline-flex min-w-0 items-baseline gap-1.5 rounded px-1 text-left"
          (click)="toggle()"
          [attr.aria-label]="(expanded() ? 'Collapse ' : 'Expand ') + (name() ?? 'value')"
        >
          <svg
            lucideChevronRight
            [size]="13"
            class="shrink-0 translate-y-[2px] text-ink-3 transition-transform duration-150"
            [class.rotate-90]="expanded()"
            aria-hidden="true"
          ></svg>
          @if (name() !== null) {
            <span class="text-ink-2">{{ name() }}</span>
          }
          <span class="text-ink-3">{{ countLabel() }}</span>
        </button>
        @if (!expanded()) {
          <span class="truncate text-ink-3">{{ preview() }}</span>
        }
      </div>
    } @else {
      <p class="min-w-0 rounded py-[3px] pr-1 pl-6 break-words hover:bg-surface-2">
        @if (name() !== null) {
          <span class="mr-1.5 text-ink-2">{{ name() }}</span>
        }
        <span [class]="valueClass()">{{ formattedValue() }}</span>
      </p>
    }
    @if (isContainer() && expanded()) {
      <ul role="group" class="ml-[9px] border-l border-rule pl-3">
        @for (entry of entries(); track entry.key) {
          <li
            appJsonNode
            [name]="entry.key"
            [value]="entry.value"
            [depth]="depth() + 1"
            [initialDepth]="initialDepth()"
            [command]="command()"
          ></li>
        }
      </ul>
    }
  `,
})
export class JsonNode {
  readonly name = input<string | null>(null);
  readonly value = input<unknown>(null);
  readonly depth = input(0);
  readonly initialDepth = input(1);
  readonly command = input<TreeCommand | null>(null);

  protected readonly kind = computed(() => kindOf(this.value()));

  protected readonly isContainer = computed(() => {
    const kind = this.kind();
    const isContainer = kind === VALUE_KINDS.OBJECT || kind === VALUE_KINDS.ARRAY;

    return isContainer;
  });

  protected readonly expanded = linkedSignal({
    source: this.command,
    computation: (command) => {
      const isExpanded = command ? command.expand : this.depth() < this.initialDepth();

      return isExpanded;
    },
  });

  protected readonly entries = computed<TreeEntry[]>(() => {
    const value = this.value();

    if (!this.isContainer()) {
      return [];
    }

    const entries = Object.entries(value as object).map(([key, entryValue]) => ({ key, value: entryValue }));

    return entries;
  });

  protected readonly countLabel = computed(() => {
    const count = this.entries().length;
    const label = this.kind() === VALUE_KINDS.ARRAY ? `[${count}]` : `{${count}}`;

    return label;
  });

  protected readonly preview = computed(() => {
    const primitives = this.entries()
      .map((entry) => entry.value)
      .filter((entryValue) => !this.isComposite(entryValue))
      .slice(0, PREVIEW_PARTS)
      .map((entryValue) => String(entryValue));
    const preview = truncate(primitives.join(PREVIEW_SEPARATOR));

    return preview;
  });

  protected readonly formattedValue = computed(() => {
    const value = this.value();

    switch (this.kind()) {
      case VALUE_KINDS.STRING:
        return `"${String(value)}"`;
      case VALUE_KINDS.NULL:
        return 'null';
      default:
        return String(value);
    }
  });

  protected readonly valueClass = computed(() => {
    switch (this.kind()) {
      case VALUE_KINDS.STRING:
        return 'text-[var(--json-string)]';
      case VALUE_KINDS.NUMBER:
        return 'text-[var(--json-number)] tabular';
      case VALUE_KINDS.BOOLEAN:
        return 'text-[var(--json-boolean)]';
      default:
        return 'italic text-ink-3';
    }
  });

  protected toggle(): void {
    this.expanded.update((isExpanded) => !isExpanded);
  }

  private isComposite(value: unknown): boolean {
    const isComposite = typeof value === 'object' && value !== null;

    return isComposite;
  }
}
