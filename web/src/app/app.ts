import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideFlaskConical,
  LucideMessageSquareText,
  LucidePackage,
  LucidePlay,
  LucideScrollText,
} from '@lucide/angular';
import { ALL_CARRIERS, CARRIER_INFO } from './core/models';
import { ToastHost } from './shared/toast-host';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ToastHost,
    LucideFlaskConical,
    LucideMessageSquareText,
    LucidePackage,
    LucidePlay,
    LucideScrollText,
  ],
  templateUrl: './app.html',
})
export class App {
  protected readonly lines = ALL_CARRIERS.map((carrier) => CARRIER_INFO[carrier]);
}
