import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, resource, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { LucideArrowRight, LucidePlus, LucideX } from '@lucide/angular';
import { Api, toErrorDetails, toErrorMessage } from '../../core/api';
import type { Shipment } from '../../core/models';
import { formatDate, lastScan, routeLabel } from '../../core/shipment-format';
import { ToastService } from '../../core/toast';
import { CarrierLine } from '../../shared/carrier-line';
import { DeleteConfirm } from '../../shared/delete-confirm';
import { JsonEditor, parseJson } from '../../shared/json-editor';
import { JsonTree } from '../../shared/json-tree/json-tree';

const PANE_MODES = {
  VIEW: 'view',
  ADD: 'add',
} as const;

type PaneMode = (typeof PANE_MODES)[keyof typeof PANE_MODES];

const SHIPMENT_ID_PREFIX = 'SH-';
const FIRST_SHIPMENT_NUMBER = 1001;
const JSON_INDENT = 2;
const STACKED_LAYOUT_QUERY = '(max-width: 1279px)';
const SKELETON_ROWS = [1, 2, 3, 4];

function nextShipmentId(shipments: Shipment[]): string {
  const numbers = shipments.map((shipment) => Number(shipment.shipment_id.replace(SHIPMENT_ID_PREFIX, '')) || 0);
  const next = numbers.reduce((highest, value) => Math.max(highest, value), FIRST_SHIPMENT_NUMBER - 1) + 1;
  const shipmentId = `${SHIPMENT_ID_PREFIX}${next}`;

  return shipmentId;
}

function buildTemplate(shipmentId: string): string {
  const template = {
    shipment_id: shipmentId,
    carrier: 'dhl',
    mode: 'air',
    origin: 'Karachi, PK',
    destination: 'Doha, QA',
    destination_country_code: 'QA',
    customer: 'Example Trading Co.',
    cargo: 'Textiles, 10 cartons',
    promised_delivery: '2026-12-01',
    temperature_controlled: false,
    scans: [
      { code: 'PU', location: 'Karachi, PK', timestamp: '2026-11-25T09:00:00Z', note: 'Picked up from shipper' },
      { code: 'HE', location: 'Doha Customs, QA', timestamp: '2026-11-27T08:00:00Z', note: 'Held at customs' },
    ],
    past_customs_history: 'First shipment to this consignee.',
  };
  const text = JSON.stringify(template, null, JSON_INDENT);

  return text;
}

@Component({
  selector: 'app-shipments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CarrierLine, DeleteConfirm, JsonEditor, JsonTree, LucideArrowRight, LucidePlus, LucideX],
  templateUrl: './shipments-page.html',
})
export class ShipmentsPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly detailPane = viewChild<ElementRef<HTMLElement>>('detailPane');

  protected readonly MODES = PANE_MODES;
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly formatDate = formatDate;
  protected readonly lastScan = lastScan;
  protected readonly routeLabel = routeLabel;

  protected readonly shipments = resource({ loader: () => this.api.listShipments() });
  protected readonly mode = signal<PaneMode>(PANE_MODES.VIEW);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly draft = signal('');
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saveDetails = signal<string[]>([]);
  protected readonly deleting = signal(false);

  protected readonly list = computed(() => {
    const list = this.shipments.hasValue() ? this.shipments.value() : [];

    return list;
  });

  protected readonly selected = computed(() => {
    const selectedId = this.selectedId();
    const shipment = this.list().find((item) => item.shipment_id === selectedId) ?? null;

    return shipment;
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

  protected startAdd(): void {
    this.draft.set(buildTemplate(nextShipmentId(this.list())));
    this.saveError.set(null);
    this.saveDetails.set([]);
    this.selectedId.set(null);
    this.mode.set(PANE_MODES.ADD);
    this.revealDetails();
  }

  protected cancelAdd(): void {
    this.mode.set(PANE_MODES.VIEW);
  }

  protected async save(): Promise<void> {
    const parsed = parseJson(this.draft());

    if (parsed.error !== null) {
      this.saveError.set('Fix the JSON before saving.');
      this.saveDetails.set([]);

      return;
    }

    this.saving.set(true);
    this.saveError.set(null);
    this.saveDetails.set([]);

    try {
      const created = await this.api.createShipment(parsed.value);
      this.toast.success(`${created.shipment_id} added`);
      this.shipments.reload();
      this.select(created.shipment_id);
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
      await this.api.deleteShipment(shipmentId);
      this.toast.success(`${shipmentId} deleted`);
      this.selectedId.set(null);
      this.shipments.reload();
    } catch (error) {
      this.toast.error(`Couldn't delete ${shipmentId}: ${toErrorMessage(error)}`);
    } finally {
      this.deleting.set(false);
    }
  }

  protected runAgent(shipmentId: string): void {
    void this.router.navigate(['/run'], { queryParams: { shipment: shipmentId } });
  }

  protected errorMessage(error: unknown): string {
    const message = toErrorMessage(error);

    return message;
  }
}
