import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CARRIER_INFO, isCarrier } from '../core/models';

const UNKNOWN_CARRIER_COLOR = 'var(--line-idle)';

@Component({
  selector: 'app-carrier-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-2 whitespace-nowrap' },
  template: `
    <span class="h-1 w-5 rounded-full" [style.background]="color()" aria-hidden="true"></span>
    <span class="label-caps text-ink-2">{{ label() }}</span>
  `,
})
export class CarrierLine {
  readonly carrier = input<string | null | undefined>(null);

  protected readonly color = computed(() => {
    const carrier = this.carrier();
    const color = isCarrier(carrier) ? CARRIER_INFO[carrier].color : UNKNOWN_CARRIER_COLOR;

    return color;
  });

  protected readonly label = computed(() => {
    const carrier = this.carrier();
    const label = isCarrier(carrier) ? CARRIER_INFO[carrier].label : (carrier ?? 'Unknown');

    return label;
  });
}
