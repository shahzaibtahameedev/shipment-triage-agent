import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  ApiErrorBody,
  HumanDecision,
  LogEntry,
  PromptView,
  RunOutcome,
  Shipment,
  TestShipment,
} from './models';

const API_ROOT = '/api';
const API_ROUTES = {
  SHIPMENTS: `${API_ROOT}/shipments`,
  TEST_SHIPMENTS: `${API_ROOT}/test-shipments`,
  RUNS: `${API_ROOT}/runs`,
  LOGS: `${API_ROOT}/logs`,
  PROMPTS: `${API_ROOT}/prompts`,
} as const;

// 0 = no response at all; 502-504 = the dev proxy couldn't reach the API
const UNREACHABLE_STATUSES = [0, 502, 503, 504];
const UNREACHABLE_MESSAGE = 'Cannot reach the API. Start it with: npm run server';

export interface LogFilters {
  shipmentId?: string;
  level?: string;
  event?: string;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  listShipments(): Promise<Shipment[]> {
    const request = firstValueFrom(this.http.get<Shipment[]>(API_ROUTES.SHIPMENTS));

    return request;
  }

  getShipment(shipmentId: string): Promise<Shipment> {
    const request = firstValueFrom(this.http.get<Shipment>(`${API_ROUTES.SHIPMENTS}/${shipmentId}`));

    return request;
  }

  createShipment(shipment: unknown): Promise<Shipment> {
    const request = firstValueFrom(this.http.post<Shipment>(API_ROUTES.SHIPMENTS, shipment));

    return request;
  }

  deleteShipment(shipmentId: string): Promise<void> {
    const request = firstValueFrom(this.http.delete<void>(`${API_ROUTES.SHIPMENTS}/${shipmentId}`));

    return request;
  }

  listTestShipments(): Promise<TestShipment[]> {
    const request = firstValueFrom(this.http.get<TestShipment[]>(API_ROUTES.TEST_SHIPMENTS));

    return request;
  }

  getTestShipment(shipmentId: string): Promise<TestShipment> {
    const request = firstValueFrom(this.http.get<TestShipment>(`${API_ROUTES.TEST_SHIPMENTS}/${shipmentId}`));

    return request;
  }

  updateTestShipment(shipmentId: string, testShipment: unknown): Promise<TestShipment> {
    const request = firstValueFrom(
      this.http.put<TestShipment>(`${API_ROUTES.TEST_SHIPMENTS}/${shipmentId}`, testShipment),
    );

    return request;
  }

  deleteTestShipment(shipmentId: string): Promise<void> {
    const request = firstValueFrom(this.http.delete<void>(`${API_ROUTES.TEST_SHIPMENTS}/${shipmentId}`));

    return request;
  }

  startRun(shipmentId: string): Promise<RunOutcome> {
    const request = firstValueFrom(this.http.post<RunOutcome>(API_ROUTES.RUNS, { shipmentId }));

    return request;
  }

  decide(shipmentId: string, decision: HumanDecision): Promise<RunOutcome> {
    const request = firstValueFrom(
      this.http.post<RunOutcome>(`${API_ROUTES.RUNS}/${shipmentId}/decision`, { decision }),
    );

    return request;
  }

  listLogs(filters: LogFilters): Promise<LogEntry[]> {
    let params = new HttpParams();
    if (filters.shipmentId) {
      params = params.set('shipmentId', filters.shipmentId);
    }
    if (filters.level) {
      params = params.set('level', filters.level);
    }
    if (filters.event) {
      params = params.set('event', filters.event);
    }
    if (filters.limit) {
      params = params.set('limit', filters.limit);
    }
    const request = firstValueFrom(this.http.get<LogEntry[]>(API_ROUTES.LOGS, { params }));

    return request;
  }

  listPrompts(): Promise<PromptView[]> {
    const request = firstValueFrom(this.http.get<PromptView[]>(API_ROUTES.PROMPTS));

    return request;
  }

  savePrompt(key: string, content: string): Promise<PromptView> {
    const request = firstValueFrom(this.http.put<PromptView>(`${API_ROUTES.PROMPTS}/${key}`, { content }));

    return request;
  }

  resetPrompt(key: string): Promise<PromptView> {
    const request = firstValueFrom(this.http.delete<PromptView>(`${API_ROUTES.PROMPTS}/${key}`));

    return request;
  }
}

function readErrorBody(error: HttpErrorResponse): Partial<ApiErrorBody> {
  const body = typeof error.error === 'object' && error.error !== null ? (error.error as Partial<ApiErrorBody>) : {};

  return body;
}

export function toErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    const message = error instanceof Error ? error.message : String(error);

    return message;
  }

  const body = readErrorBody(error);

  if (!body.error && UNREACHABLE_STATUSES.includes(error.status)) {
    return UNREACHABLE_MESSAGE;
  }

  const message = body.error || error.message;

  return message;
}

export function toErrorDetails(error: unknown): string[] {
  if (!(error instanceof HttpErrorResponse)) {
    return [];
  }

  const details = readErrorBody(error).details ?? [];

  return details;
}
