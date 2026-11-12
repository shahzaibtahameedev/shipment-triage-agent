import { Injectable, signal } from '@angular/core';

export const TOAST_TONES = {
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

export type ToastTone = (typeof TOAST_TONES)[keyof typeof TOAST_TONES];

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

const TOAST_DURATION_MS = 3500;
const ERROR_TOAST_DURATION_MS = 6000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  success(message: string): void {
    this.show(TOAST_TONES.SUCCESS, message, TOAST_DURATION_MS);
  }

  error(message: string): void {
    this.show(TOAST_TONES.ERROR, message, ERROR_TOAST_DURATION_MS);
  }

  dismiss(id: number): void {
    this.toasts.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private show(tone: ToastTone, message: string, durationMs: number): void {
    const toast: Toast = { id: this.nextId, tone, message };
    this.nextId += 1;
    this.toasts.update((toasts) => toasts.concat(toast));
    setTimeout(() => this.dismiss(toast.id), durationMs);
  }
}
