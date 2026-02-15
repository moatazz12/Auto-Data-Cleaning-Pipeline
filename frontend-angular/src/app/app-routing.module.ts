import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// ─── Composants d'authentification ──────────────────────────────────────────
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';

// ─── Pages légales ───────────────────────────────────────────────────────────
import { TermsOfUseComponent } from './features/legal/terms-of-use/terms-of-use.component';
import { PrivacyPolicyComponent } from './features/legal/privacy-policy/privacy-policy.component';

// ─── Fonctionnalités principales ─────────────────────────────────────────────
import { WorkspaceListComponent } from './features/workspaces/workspace-list/workspace-list.component';
import { WorkspaceDetailComponent } from './features/workspaces/workspace-detail/workspace-detail.component';
import { CleaningReportComponent } from './features/workspaces/cleaning-report/cleaning-report.component';

// ─── Dashboard (comme FirstApp) ───────────────────────────────────────────────
import { DashboardComponent } from './features/dashboard/dashboard.component';

// ─── Layout Shell (comme FirstApp/template) ───────────────────────────────────
import { LayoutComponent } from './shared/layout/layout.component';

// ─── Guards — protège les routes authentifiées ────────────────────────────────
import { authGuard, guestGuard } from './core/guards/auth.guard';

/**
 * Définition des routes de l'application.
 * Structure inspirée du cours (FirstApp/app-routing.module.ts) :
 * - pathMatch: 'full' pour éviter les conflits sur la route vide
 * - canActivate: [authGuard] pour protéger les pages privées
 * - canActivate: [guestGuard] pour rediriger les utilisateurs déjà connectés
 * - path: '**' pour capturer les routes inconnues
 */
const routes: Routes = [
  // 1. Redirection par défaut vers la page de connexion (comme FirstApp)
  { path: '', redirectTo: '/login', pathMatch: 'full' },

  // ─── Pages publiques (non authentifiées) ────────────────────────────────
  { path: 'login',    component: LoginComponent,    canActivate: [guestGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [guestGuard] },

  // ─── Pages légales (accessibles sans connexion) ─────────────────────────
  { path: 'terms-of-use',    component: TermsOfUseComponent },
  { path: 'privacy-policy',  component: PrivacyPolicyComponent },

  // ─── Application principale (protégée par authGuard) ────────────────────
  // Layout shell — contient sidebar + topbar + router-outlet (comme template.component)
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      // Dashboard — tableau de bord avec graphiques (comme FirstApp/dashboard)
      { path: 'dashboard', component: DashboardComponent },

      // Workspaces — liste paginée avec filtres
      { path: 'workspaces', component: WorkspaceListComponent },

      // Détail workspace + sessions d'analyse
      { path: 'workspaces/:id/sessions', component: WorkspaceDetailComponent },
      { path: 'workspaces/:id',          component: WorkspaceDetailComponent },

      // Rapport de nettoyage d'un dataset
      {
        path: 'workspaces/:id/cleaned-dataset/:cleanedDatasetId/report',
        component: CleaningReportComponent
      }
    ]
  },

  // 3. Route Wildcard — comme path: '**' dans FirstApp (redirige vers login)
  { path: '**', redirectTo: '/login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
