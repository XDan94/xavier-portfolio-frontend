import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./features/contact/contact/contact.component').then(m => m.ContactComponent),
  },/*
  {
    path: 'client/login',
    loadComponent: () =>
      import('./features/client/login/login').then(m => m.LoginComponent),
  },
  {
    path: 'client',
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/client/dashboard/dashboard').then(m => m.DashboardComponent),
      },
      {
        path: 'quotes',
        loadComponent: () =>
          import('./features/client/quotes/quotes').then(m => m.QuotesComponent),
      },
      {
        path: 'quotes/:id',
        loadComponent: () =>
          import('./features/client/quote-detail/quote-detail').then(m => m.QuoteDetailComponent),
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },*/
  {
    path: '**',
    redirectTo: '',
  },
];
