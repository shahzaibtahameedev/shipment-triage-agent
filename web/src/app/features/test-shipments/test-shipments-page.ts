import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, resource, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { LucideArrowRight, LucidePencil, LucideX } from '@lucide/angular';
import { Api, toErrorDetails, toErrorMessage } from '../../core/api';
import { ACTION_LABELS, ALL_ACTIONS, type TestShipment, type TriageAction } from '../../core/models';
import { routeLabel } from '../../core/shipment-format';
import { ToastService } from '../../core/toast';
import { ActionBadge } from '../../shared/action-badge';
import { CarrierLine } from '../../shared/carrier-line';
import { DeleteConfirm } from '../../shared/delete-confirm';
import { JsonEditor, parseJson } from '../../shared/json-editor';
import { JsonTree } from '../../shared/json-tree/json-tree';

const PANE_MODES = {
  VIEW: 'view',
  EDIT: 'edit',
} as const;

type PaneMode = (typeof PANE_MODES)[keyof typeof PANE_MODES];

const FALSE_POSITIVE_CHOICES = {
  YES: 'yes',
  NO: 'no',
  EITHER: 'either',
} as const;

type FalsePositiveChoice = (typeof FALSE_POSITIVE_CHOICES)[keyof typeof FALSE_POSITIVE_CHOICES];

const JSON_INDENT = 2;
const STACKED_LAYOUT_QUERY = '(max-width: 1279px)';
const SKELETON_ROWS = [1, 2, 3];

function toChoice(value: boolean | null): FalsePositiveChoice {
  if (value === null) {
    return FALSE_POSITIVE_CHOICES.EITHER;
  }

  const choice = value ? FALSE_POSITIVE_CHOICES.YES : FALSE_POSITIVE_CHOICES.NO;

  return choice;
}

function fromChoice(choice: FalsePositiveChoice): boolean | null {
  switch (choice) {
    case FALSE_POSITIVE_CHOICES.YES:
      return true;
    case FALSE_POSITIVE_CHOICES.NO:
      return false;
    default:
      return null;
  }
}

@Component({
  selector: 'app-test-shipments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBadge, CarrierLine, DeleteConfirm, JsonEditor, JsonTree, LucideArrowRight, LucidePencil, LucideX],
  templateUrl: './test-shipments-page.html',
})
export class TestShipmentsPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly detailPane = viewChild<ElementRef<HTMLElement>>('detailPane');

  protected readonly MODES = PANE_MODES;
  protected readonly CHOICES = FALSE_POSITIVE_CHOICES;
  protected readonly choiceOrder: FalsePositiveChoice[] = [
    FALSE_POSITIVE_CHOICES.NO,
    FALSE_POSITIVE_CHOICES.YES,
    FALSE_POSITIVE_CHOICES.EITHER,
  ];
  protected readonly ACTION_LABELS = ACTION_LABELS;
  protected readonly allActions = ALL_ACTIONS;
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly routeLabel = routeLabel;

  protected readonly testShipments = resource({ loader: () => this.api.listTestShipments() });
  protected readonly mode = signal<PaneMode>(PANE_MODES.VIEW);
  protected readonly selectedId = signal<string | null>(null);

  protected readonly draftChoice = signal<FalsePositiveChoice>(FALSE_POSITIVE_CHOICES.EITHER);
  protected readonly draftActions = signal<TriageAction[]>([]);
  protected readonly draftNotes = signal('');
  protected readonly draftShipment = signal('');
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saveDetails = signal<string[]>([]);
  protected readonly deleting = signal(false);

  protected readonly list = computed(() => {
    const list = this.testShipments.hasValue() ? this.testShipments.value() : [];

    return list;
  });

  protected readonly selected = computed<TestShipment | null>(() => {
    const selectedId = this.selectedId();
    const testShipment = this.list().find((item) => item.shipment.shipment_id === selectedId) ?? null;

    return testShipment;
  });

  protected select(shipmentId: string): void {
    this.mode.set(PANE_MODES.VIEW);
    this.selectedId.set(shipmentId);
    this.revealDetails();
  }

  // Below xl the detail pane sits under the table, so bring it into view
  private revealDetails(): void {
    const pane = this.detailPane()?.nativeElement;

    if (pane && window.matchMedia(STACKED_LAYOUT_QUERY).matches) {
      pane.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  protected startEdit(testShipment: TestShipment): void {
    this.draftChoice.set(toChoice(testShipment.expected.false_positive));
    this.draftActions.set(testShipment.expected.actions);
    this.draftNotes.set(testShipment.expected.notes);
    this.draftShipment.set(JSON.stringify(testShipment.shipment, null, JSON_INDENT));
    this.saveError.set(null);
    this.saveDetails.set([]);
    this.mode.set(PANE_MODES.EDIT);
  }

  protected cancelEdit(): void {
    this.mode.set(PANE_MODES.VIEW);
  }

  protected toggleAction(action: TriageAction, checked: boolean): void {
    const withoutAction = this.draftActions().filter((item) => item !== action);
    const next = checked ? withoutAction.concat(action) : withoutAction;
    const ordered = ALL_ACTIONS.filter((item) => next.includes(item));
    this.draftActions.set(ordered);
  }

  protected async save(shipmentId: string): Promise<void> {
    const parsed = parseJson(this.draftShipment());

    if (parsed.error !== null) {
      this.saveError.set('Fix the shipment JSON before saving.');
      this.saveDetails.set([]);

      return;
    }

    const body = {
      shipment: parsed.value,
      expected: {
        false_positive: fromChoice(this.draftChoice()),
        actions: this.draftActions(),
        notes: this.draftNotes().trim(),
      },
    };
    this.saving.set(true);
    this.saveError.set(null);
    this.saveDetails.set([]);

    try {
      await this.api.updateTestShipment(shipmentId, body);
      this.toast.success(`${shipmentId} saved`);
      this.testShipments.reload();
      this.mode.set(PANE_MODES.VIEW);
    } catch (error) {
      this.saveError.set(toErrorMessage(error));
      this.saveDetails.set(toErrorDetails(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(shipmentId: string): Promise<void> {
    this.deleting.set(true);

    try {
      await this.api.deleteTestShipment(shipmentId);
      this.toast.success(`${shipmentId} deleted`);
      this.selectedId.set(null);
      this.testShipments.reload();
    } catch (error) {
      this.toast.error(`Couldn't delete ${shipmentId}: ${toErrorMessage(error)}`);
    } finally {
      this.deleting.set(false);
    }
  }

  protected runAgent(shipmentId: string): void {
    void this.router.navigate(['/run'], { queryParams: { test: shipmentId } });
  }

  protected falsePositiveLabel(value: boolean | null): string {
    switch (value) {
      case true:
        return 'False positive';
      case false:
        return 'Real exception';
      default:
        return 'Either verdict';
    }
  }

  protected errorMessage(error: unknown): string {
    const message = toErrorMessage(error);

    return message;
  }
}
