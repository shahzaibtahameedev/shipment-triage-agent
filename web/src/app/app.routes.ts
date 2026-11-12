import type { Routes } from '@angular/router';

const APP_TITLE = 'Shipment Triage';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'run' },
  {
    path: 'run',
    title: `Run Agent · ${APP_TITLE}`,
    loadComponent: () => import('./features/run-agent/run-agent-page').then((m) => m.RunAgentPage),
  },
  {
    path: 'shipments',
    title: `Shipments · ${APP_TITLE}`,
    loadComponent: () => import('./features/shipments/shipments-page').then((m) => m.ShipmentsPage),
  },
  {
    path: 'test-shipments',
    title: `Test Shipments · ${APP_TITLE}`,
    loadComponent: () => import('./features/test-shipments/test-shipments-page').then((m) => m.TestShipmentsPage),
  },
  {
    path: 'logs',
    title: `Logs · ${APP_TITLE}`,
    loadComponent: () => import('./features/logs/logs-page').then((m) => m.LogsPage),
  },
  {
    path: 'prompts',
    title: `Prompts · ${APP_TITLE}`,
    loadComponent: () => import('./features/prompts/prompts-page').then((m) => m.PromptsPage),
    canDeactivate: [(page: { canLeave: () => boolean }) => page.canLeave()],
  },
  { path: '**', redirectTo: 'run' },
];
