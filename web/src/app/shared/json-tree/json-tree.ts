import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { LucideChevronsDownUp, LucideChevronsUpDown } from '@lucide/angular';
import { JsonNode, type TreeCommand } from './json-node';

interface RootEntry {
  key: string;
  value: unknown;
}

@Component({
  selector: 'app-json-tree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonNode, LucideChevronsDownUp, LucideChevronsUpDown],
  host: { class: 'block' },
  template: `
    @if (showToolbar()) {
      <div class="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <ng-content select="[treeTitle]" />
        <div class="ml-auto flex gap-1">
          <button type="button" class="btn btn-ghost btn-sm" (click)="setAll(true)">
            <svg lucideChevronsUpDown aria-hidden="true"></svg>
            Expand all
          </button>
          <button type="button" class="btn btn-ghost btn-sm" (click)="setAll(false)">
            <svg lucideChevronsDownUp aria-hidden="true"></svg>
            Collapse all
          </button>
        </div>
      </div>
    }
    <ul role="tree" [attr.aria-label]="label()" class="font-mono text-[0.8125rem] leading-relaxed">
      @for (entry of rootEntries(); track entry.key) {
        <li
          appJsonNode
          [name]="entry.key"
          [value]="entry.value"
          [depth]="0"
          [initialDepth]="initialDepth()"
          [command]="command()"
        ></li>
      } @empty {
        <li appJsonNode [value]="value()" [initialDepth]="initialDepth()" [command]="command()"></li>
      }
    </ul>
  `,
})
export class JsonTree {
  readonly value = input<unknown>(null);
  readonly label = input('JSON');
  readonly initialDepth = input(1);
  readonly showToolbar = input(true);

  protected readonly command = signal<TreeCommand | null>(null);

  protected readonly rootEntries = computed<RootEntry[]>(() => {
    const value = this.value();

    if (typeof value !== 'object' || value === null) {
      return [];
    }

    const entries = Object.entries(value).map(([key, entryValue]) => ({ key, value: entryValue }));

    return entries;
  });

  protected setAll(expand: boolean): void {
    const version = (this.command()?.version ?? 0) + 1;
    this.command.set({ expand, version });
  }
}
