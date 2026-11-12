import type { Scan, Shipment } from './models';

const EMPTY_VALUE = '—';
const ROUTE_ARROW = ' → ';
const DATE_ONLY_LENGTH = 10;

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function lastScan(shipment: Shipment): Scan | null {
  const scan = shipment.scans?.at(-1) ?? null;

  return scan;
}

export function routeLabel(shipment: Shipment): string {
  const origin = shipment.origin ?? EMPTY_VALUE;
  const destination = shipment.destination ?? EMPTY_VALUE;
  const route = `${origin}${ROUTE_ARROW}${destination}`;

  return route;
}

export function formatDate(value: string | undefined): string {
  if (!value) {
    return EMPTY_VALUE;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const formatter = value.length > DATE_ONLY_LENGTH ? DATE_TIME_FORMAT : DATE_FORMAT;
  const formatted = formatter.format(date);

  return formatted;
}
