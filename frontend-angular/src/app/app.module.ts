import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

// Routing principal
import { AppRoutingModule } from './app-routing.module';

// Composant racine
import { AppComponent } from './app.component';

// ─── Authentification ────────────────────────────────────────────────────
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';

// ─── Pages légales ────────────────────────────────────────────────────────
import { TermsOfUseComponent } from './features/legal/terms-of-use/terms-of-use.component';
import { PrivacyPolicyComponent } from './features/legal/privacy-policy/privacy-policy.component';

// ─── Workspaces (fonctionnalité principale) ────────────────────────────────
import { WorkspaceListComponent } from './features/workspaces/workspace-list/workspace-list.component';
import { WorkspaceDetailComponent } from './features/workspaces/workspace-detail/workspace-detail.component';
import { CleaningReportComponent } from './features/workspaces/cleaning-report/cleaning-report.component';

// ─── Dashboard (comme FirstApp/dashboard) ─────────────────────────────────
import { DashboardComponent } from './features/dashboard/dashboard.component';

// ─── Layout Shell (comme FirstApp/template) ───────────────────────────────
import { LayoutComponent } from './shared/layout/layout.component';

// ─── Toast Notification Component ─────────────────────────────────────
import { ToastComponent } from './shared/toast/toast.component';

// ─── Intercepteur JWT (injection du token dans chaque requête HTTP) ────────
import { JwtInterceptor } from './core/interceptors/jwt.interceptor';

// ─── NgChartsModule — graphiques Chart.js (comme FirstApp NgChartsModule) ──
import { NgChartsModule } from 'ng2-charts';

// ─── DatePipe — pour les pipes de date dans les templates ─────────────────
import { DatePipe } from '@angular/common';

@NgModule({
  declarations: [
    AppComponent,

    // Auth
    LoginComponent,
    RegisterComponent,

    // Légal
    TermsOfUseComponent,
    PrivacyPolicyComponent,

    // Workspaces
    WorkspaceListComponent,
    WorkspaceDetailComponent,
    CleaningReportComponent,

    // Dashboard 
    DashboardComponent,

    // Shell Layout 
    LayoutComponent,

    // Toast notifications
    ToastComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,

    // Formulaires réactifs et template-driven
    ReactiveFormsModule,
    FormsModule,

    // Graphiques Chart.js — même import que FirstApp
    NgChartsModule
  ],
  providers: [
    // Intercepteur JWT : ajoute automatiquement le token Bearer à chaque requête
    { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },

    // DatePipe disponible dans les services
    DatePipe
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
