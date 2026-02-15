/**
 * ============================================================
 * FICHIER  : dashboard.component.ts
 * COMPOSANT: DashboardComponent
 * ROUTE    : /dashboard
 *
 * RÔLE     : Tableau de bord principal de l'application.
 *            Affiche des statistiques globales et 4 graphiques
 *            Chart.js basés sur les données de l'utilisateur.
 *
 * DONNÉES AFFICHÉES :
 *  • Nombre de workspaces (possédés + partagés)
 *  • Nombre de sessions d'analyse au total
 *  • Nombre de datasets nettoyés
 *  • Nombre de membres collaborateurs uniques
 *
 * GRAPHIQUES (Chart.js via ng2-charts) :
 *  • PIE      → Répartition Owner / Shared
 *  • DOUGHNUT → Top 5 workspaces par nombre de membres
 *  • BAR      → Top 6 workspaces par nombre de sessions
 *  • LINE     → Volume de données (lignes) des 8 sessions récentes
 *
 * PATTERN RxJS : forkJoin() — attend que TOUS les Observables
 *   se terminent avant de traiter le résultat (comme Promise.all)
 * ============================================================
 */
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ChartDataset, ChartOptions, ChartType } from 'chart.js';

// Services métier
import { WorkspaceService } from '../../core/services/workspace.service';
import { AnalysisSessionService } from '../../core/services/analysis-session.service';
import { CleanedDatasetService } from '../../core/services/cleaned-dataset.service';
import { AuthService } from '../../core/services/auth.service';
import { WorkspaceMembersService } from '../../core/services/workspace-members.service';

// Modèles
import { WorkspaceWithMembersDto } from '../../core/models/workspace.model';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  // ─── Valeurs statistiques brutes ───────────────────────────────────────────
  nbWorkspaces: number = 0;       // Total de workspaces de l'utilisateur
  nbSessions: number = 0;         // Total de sessions d'analyse
  nbCleanedDatasets: number = 0;  // Total de datasets nettoyés
  nbMembers: number = 0;          // Nombre de collaborateurs uniques

  // ─── Valeurs animées (affichées dans les cartes stat) ─────────────────────
  // Ces variables passent de 0 à la valeur cible via animateCounters()
  nbWorkspacesDisplay: number = 0;
  nbSessionsDisplay: number = 0;
  nbCleanedDatasetsDisplay: number = 0;
  nbMembersDisplay: number = 0;

  // ─── État de chargement ────────────────────────────────────────────────────
  isLoading: boolean = true; // true → affiche le spinner, false → affiche les données

  // ─── Données brutes récupérées depuis l'API ────────────────────────────────
  workspaces: WorkspaceWithMembersDto[] = [];
  userDisplayName: string = '';   // "Prénom Nom" affiché dans le header du dashboard

  /**
   * recentWorkspaces — Getter calculé dynamiquement.
   * Retourne les 4 workspaces les plus récents triés par date de création.
   * Mis à jour automatiquement par le Data Binding dès que `workspaces` change.
   */
  get recentWorkspaces(): WorkspaceWithMembersDto[] {
    return [...this.workspaces]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4);
  }

  // ─── Graphique 1 : PIE — Owned vs Shared ──────────────────────────────────
  chartDataPie: ChartDataset[] = [{ data: [] }];
  chartLabelsPie: string[] = ['Owned', 'Shared'];
  chartTypePie: ChartType = 'pie';

  // ─── Graphique 2 : DOUGHNUT — Top workspaces par membres ──────────────────
  chartDataDoughnut: ChartDataset[] = [{ data: [] }];
  chartLabelsDoughnut: string[] = [];
  chartTypeDoughnut: ChartType = 'doughnut';

  // ─── Graphique 3 : BAR — Sessions par workspace ───────────────────────────
  chartDataLine: ChartDataset[] = [{ data: [], label: 'Sessions per workspace' }];
  chartLabelsLine: string[] = [];
  chartTypeLine: ChartType = 'bar';

  // ─── Graphique 4 : LINE — Volume de données (lignes traitées) ────────────
  chartDataActivity: ChartDataset[] = [{ data: [], label: 'Rows Processed' }];
  chartLabelsActivity: string[] = [];
  chartTypeActivity: ChartType = 'line';

  // ─── Options communes à tous les graphiques ────────────────────────────────
  chartOptions: ChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' }
    }
  };

  constructor(
    private workspaceService: WorkspaceService,
    private sessionService: AnalysisSessionService,
    private cleanService: CleanedDatasetService,
    private authService: AuthService,
    private memberService: WorkspaceMembersService,
    private router: Router
  ) {
    // Récupérer le nom d'affichage depuis localStorage (stocké lors du login)
    this.userDisplayName = localStorage.getItem('displayName') || 'there';
  }

  /**
   * ngOnInit — Point d'entrée du composant (cycle de vie Angular).
   * Appelé automatiquement après la création du composant.
   */
  ngOnInit(): void {
    this.loadDashboardData();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MÉTHODE PRINCIPALE : Chargement des données du dashboard
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Charge toutes les données du dashboard en deux phases :
   *  Phase 1 : Workspaces possédés + partagés (forkJoin)
   *  Phase 2 : Sessions de chaque workspace (forkJoin imbriqué)
   *
   * PATTERN forkJoin : Attend que TOUS les appels parallèles
   * se terminent avant de traiter les résultats.
   * Équivalent de Promise.all() en version RxJS.
   */
  loadDashboardData(): void {
    this.isLoading = true;

    // PHASE 1 : Charger les workspaces possédés ET partagés en parallèle
    forkJoin({
      owned: this.workspaceService.getWorkspaces(),       // Workspaces créés par l'utilisateur
      shared: this.workspaceService.getSharedWorkspaces() // Workspaces où il est membre
    }).subscribe({
      next: ({ owned, shared }) => {
        // Fusionner les deux listes et supprimer les doublons (même ID)
        const all = [...owned, ...shared];
        this.workspaces = Array.from(new Map(all.map(w => [w.id, w])).values());
        this.nbWorkspaces = this.workspaces.length;

        // Compter les membres uniques sur tous les workspaces (ensemble Set)
        const allMemberIds = new Set<string>();
        this.workspaces.forEach(ws => {
          ws.members?.forEach(m => allMemberIds.add(m.userId));
        });
        this.nbMembers = allMemberIds.size;

        // ── Graphique PIE : proportion Owner vs Shared ───────────────────
        const nbOwned = owned.length;
        const nbShared = this.workspaces.length - nbOwned;
        this.chartDataPie = [{ data: [nbOwned, nbShared] }];

        // ── Graphique DOUGHNUT : Top 5 workspaces par nombre de membres ──
        const top5 = this.workspaces
          .sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0))
          .slice(0, 5);
        this.chartLabelsDoughnut = top5.map(w => w.name);
        this.chartDataDoughnut = [{ data: top5.map(w => w.members?.length || 0) }];

        // PHASE 2 : Charger les sessions pour chaque workspace
        this.loadSessionsData();
      },
      error: () => {
        this.isLoading = false; // Arrêter le chargement même en cas d'erreur
      }
    });
  }

  /**
   * Phase 2 : Charge les sessions d'analyse pour tous les workspaces.
   * Utilise forkJoin pour lancer TOUS les appels en parallèle.
   * Résultat : un tableau de tableaux de sessions (une liste par workspace).
   */
  loadSessionsData(): void {
    if (this.workspaces.length === 0) {
      this.isLoading = false;
      return;
    }

    // Créer un Observable de sessions pour chaque workspace
    const sessionRequests = this.workspaces.map(ws =>
      this.sessionService.getByWorkspace(ws.id)
    );

    // forkJoin : attend que TOUTES les requêtes soient terminées
    forkJoin(sessionRequests).subscribe({
      next: (allSessions) => {

        // Compter le total de sessions sur tous les workspaces
        this.nbSessions = allSessions.reduce((sum, s) => sum + s.length, 0);

        // Associer chaque workspace à son nombre de sessions
        const wsWithSessions = this.workspaces.map((ws, index) => ({
          workspace: ws,
          sessionsCount: allSessions[index].length
        }));

        // Trier par nombre de sessions (desc) et prendre les 6 premiers
        const wsToDisplay = wsWithSessions
          .sort((a, b) => b.sessionsCount - a.sessionsCount)
          .slice(0, 6);

        // ── Graphique BAR : Top 6 workspaces par sessions ─────────────────
        this.chartLabelsLine = wsToDisplay.map(item =>
          // Tronquer les noms trop longs pour lisibilité
          item.workspace.name.length > 12
            ? item.workspace.name.substring(0, 12) + '…'
            : item.workspace.name
        );
        this.chartDataLine = [{
          data: wsToDisplay.map(item => item.sessionsCount),
          label: 'Sessions',
          backgroundColor: [
            'rgba(79, 70, 229, 0.8)', 'rgba(124, 58, 237, 0.8)',
            'rgba(37, 99, 235, 0.8)', 'rgba(99, 102, 241, 0.7)',
            'rgba(167, 139, 250, 0.7)', 'rgba(30, 64, 175, 0.7)'
          ],
          borderColor: '#4f46e5',
          borderWidth: 2,
          borderRadius: 8
        }];

        // Nombre de datasets nettoyés = approximation par nombre de sessions
        this.nbCleanedDatasets = allSessions.flat().length;

        // ── Graphique LINE : Volume de données (8 sessions récentes) ──────
        const recentSessions = allSessions.flat()
          .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
          .slice(0, 8)   // 8 sessions les plus récentes
          .reverse();    // Ordre chronologique (plus ancien → plus récent)

        this.chartLabelsActivity = recentSessions.map(s =>
          s.sessionName.length > 10 ? s.sessionName.substring(0, 10) + '…' : s.sessionName
        );
        this.chartDataActivity = [{
          data: recentSessions.map(s => s.rowCount),
          label: 'Rows',
          fill: true,
          tension: 0.4,                            // Courbe lissée
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#fff',
          pointRadius: 4,
          pointHoverRadius: 6
        }];

        this.isLoading = false;
        this.animateCounters(); // Lancer l'animation des compteurs
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  /** Navigue vers la liste des workspaces */
  goToWorkspaces(): void {
    this.router.navigate(['/workspaces']);
  }

  // ─── Animation des compteurs ──────────────────────────────────────────────

  /**
   * Anime les valeurs des cartes statistiques de 0 jusqu'à leur valeur cible.
   * Crée un "effet de compteur" visuel en incrémentant par petits pas.
   * Durée totale : 900ms, en 40 étapes.
   */
  private animateCounters(): void {
    const targets = [
      { key: 'nbWorkspacesDisplay', target: this.nbWorkspaces },
      { key: 'nbSessionsDisplay', target: this.nbSessions },
      { key: 'nbCleanedDatasetsDisplay', target: this.nbCleanedDatasets },
      { key: 'nbMembersDisplay', target: this.nbMembers }
    ];

    targets.forEach(({ key, target }) => {
      const duration = 900;   // Durée totale de l'animation (ms)
      const steps = 40;       // Nombre d'étapes
      const increment = target / steps;
      let current = 0;
      let step = 0;

      // setInterval crée un minuteur qui s'exécute toutes les (duration/steps) ms
      const timer = setInterval(() => {
        step++;
        current = Math.min(Math.round(increment * step), target);
        (this as any)[key] = current;
        if (step >= steps) clearInterval(timer); // Arrêter quand on atteint la cible
      }, duration / steps);
    });
  }

  // ─── Déconnexion ──────────────────────────────────────────────────────────

  /** Déconnecte l'utilisateur et redirige vers la page de connexion */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
