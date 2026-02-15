/**
 * ============================================================
 * FICHIER  : workspace-detail.component.ts
 * COMPOSANT: WorkspaceDetailComponent
 * ROUTE    : /workspaces/:id/sessions
 *
 * RÔLE     : Page de détail d'un espace de travail.
 *            Affiche les sessions d'analyse, les membres,
 *            et les statistiques globales du workspace.
 *
 * FONCTIONNALITÉS :
 *  • Chargement parallèle (forkJoin) : workspace + sessions + membres
 *  • Gestion des rôles : Owner, Editor, Viewer
 *  • Upload de fichier CSV (nouvelle session d'analyse)
 *  • Nettoyage de données (Clean) → navigue vers le rapport
 *  • Suppression et renommage de sessions
 *  • Visualisation des métriques qualité (modal)
 *  • Invitation et suppression de membres (Owner seulement)
 *  • Notifications Toast pour le feedback utilisateur
 *
 * PATTERN RxJS :
 *  • forkJoin() : Charge le workspace, les sessions et les membres
 *    en parallèle et attend que TOUS les appels se terminent.
 * ============================================================
 */
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { WorkspaceWithMembersDto } from '../../../core/models/workspace.model';
import { AnalysisSession, AnalysisSessionService, AnalysisSessionUpdateDto } from '../../../core/services/analysis-session.service';
import { WorkspaceMemberDto, WorkspaceMembersService } from '../../../core/services/workspace-members.service';
import { DataQualityService } from '../../../core/services/data-quality.service';
import { DataQualityMetric } from '../../../core/models/data-quality-metric.model';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { CleanedDatasetService } from '../../../core/services/cleaned-dataset.service';
import { CleaningRequestDto } from '../../../core/models/cleaned-dataset.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-workspace-detail',
  templateUrl: './workspace-detail.component.html',
  styleUrls: ['./workspace-detail.component.css']
})
export class WorkspaceDetailComponent implements OnInit {

  // ─── Identifiants de route ────────────────────────────────────────────────
  /** ID du workspace lu depuis l'URL (paramètre :id) */
  workspaceId!: number;

  // ─── Données principales ──────────────────────────────────────────────────
  /** Workspace complet avec ses membres (null tant que non chargé) */
  workspace: WorkspaceWithMembersDto | null = null;
  /** Liste des sessions d'analyse triées par date décroissante */
  sessions: AnalysisSession[] = [];
  /** Liste des membres du workspace */
  members: WorkspaceMemberDto[] = [];

  // ─── État de chargement ───────────────────────────────────────────────────
  /** true → affiche le spinner, false → affiche le contenu */
  isLoading = true;
  /** Nom affiché dans le hero header (récupéré depuis localStorage) */
  userDisplayName = 'there';

  // ─── Statistiques globales ────────────────────────────────────────────────
  /** Total des lignes de données sur toutes les sessions */
  totalRows = 0;
  /** Nombre de colonnes de la session la plus récente */
  totalColumns = 0;
  /** Score de qualité global (placeholder à 85%) */
  globalQuality = 0;

  // ─── Modal : Métriques de qualité ─────────────────────────────────────────
  showMetricsModal = false;
  isLoadingMetrics = false;
  metricsError = '';
  /** Métriques de la session sélectionnée (triées par position) */
  selectedSessionMetrics: DataQualityMetric[] = [];
  /** Nom de la session affichée dans le modal */
  metricsSessionTitle = '';

  // ─── Modal : Nettoyage de données ─────────────────────────────────────────
  showCleanModal = false;
  isCleaning = false;
  /** Nom du dataset nettoyé proposé par défaut ("Cleaned - <sessionName>") */
  cleaningName = '';
  cleanError = '';
  /** ID de la session à nettoyer (défini à l'ouverture du modal) */
  cleaningSessionId: number | null = null;

  // ─── Modal : Suppression de session ───────────────────────────────────────
  showDeleteModal = false;
  isDeleting = false;
  deleteError = '';
  /** ID de la session à supprimer */
  deletingSessionId: number | null = null;

  // ─── Modal : Renommage de session ──────────────────────────────────────────
  showRenameModal = false;
  isRenaming = false;
  renameError = '';
  /** ID de la session en cours de renommage */
  renamingSessionId: number | null = null;
  /** Nouvelle valeur du nom saisie dans le modal */
  renameValue = '';

  // ─── Modal : Upload de fichier CSV ────────────────────────────────────────
  showUploadModal = false;
  isUploading = false;
  /** Nom de la session à créer (pré-rempli avec le nom du fichier) */
  uploadSessionName = '';
  /** Fichier CSV sélectionné dans l'input file */
  selectedFile: File | null = null;
  uploadError = '';

  // ─── Modal : Invitation de membre ─────────────────────────────────────────
  showInviteModal = false;
  isInviting = false;
  /** Terme de recherche saisi dans le champ d'invitation */
  inviteSearch = '';
  /** Utilisateur sélectionné dans les suggestions de recherche */
  selectedInviteUser: any = null;
  /** Résultats filtrés de la recherche (max 5) */
  filteredUsers: any[] = [];
  /** Tous les utilisateurs du système (chargés à l'ouverture du modal) */
  allSystemUsers: any[] = [];
  /** Rôle attribué au nouveau membre ("Viewer" par défaut) */
  inviteRole = 'Viewer';
  inviteError = '';

  // ─── Modal : Suppression de membre ────────────────────────────────────────
  showRemoveMemberModal = false;
  isRemovingMember = false;
  /** ID de la relation membre-workspace à supprimer */
  removingMemberId: number | null = null;
  /** Nom du membre à supprimer (affiché dans le modal de confirmation) */
  removingMemberName = '';
  removeMemberError = '';

  /**
   * Constructeur — Injection des dépendances.
   * @param route               Accès aux paramètres de l'URL (:id)
   * @param router              Navigation programmatique
   * @param workspaceService    Récupération du workspace par ID
   * @param sessionService      CRUD des sessions d'analyse
   * @param memberService       Gestion des membres du workspace
   * @param qualityService      Récupération/calcul des métriques qualité
   * @param authService         Récupération de la liste des utilisateurs
   * @param cleanedDatasetService Nettoyage et téléchargement des datasets
   * @param toast               Notifications toast (succès/erreur)
   */
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workspaceService: WorkspaceService,
    private sessionService: AnalysisSessionService,
    private memberService: WorkspaceMembersService,
    private qualityService: DataQualityService,
    private authService: AuthService,
    private cleanedDatasetService: CleanedDatasetService,
    private toast: ToastService
  ) {
    this.userDisplayName = localStorage.getItem('displayName') || 'there';
  }

  /**
   * ngOnInit — S'abonne aux paramètres de route pour lire l'ID du workspace.
   * Dès que l'ID est disponible, déclenche le chargement des données.
   */
  ngOnInit() {
    this.route.params.subscribe(params => {
      this.workspaceId = +params['id']; // '+' convertit string → number
      if (this.workspaceId) {
        this.loadData();
      }
    });
  }

  // ─── Chargement des données ───────────────────────────────────────────────

  /**
   * loadData — Charge en parallèle le workspace, ses sessions et ses membres.
   *
   * PATTERN forkJoin : Lance 3 requêtes simultanément et attend que
   * toutes soient terminées avant de traiter les résultats.
   * Équivalent de Promise.all() en version RxJS.
   */
  loadData() {
    this.isLoading = true;

    forkJoin({
      workspace: this.workspaceService.getWorkspaceById(this.workspaceId),
      sessions:  this.sessionService.getByWorkspace(this.workspaceId),
      members:   this.memberService.getByWorkspace(this.workspaceId)
    }).subscribe({
      next: (results) => {
        this.workspace = results.workspace;
        // Trier les sessions du plus récent au plus ancien
        this.sessions = results.sessions.sort((a, b) =>
          new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
        );
        this.members = results.members;
        this.calculateStats();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading workspace detail:', err);
        this.isLoading = false;
      }
    });
  }

  /**
   * calculateStats — Calcule les statistiques globales à partir des sessions.
   * Totalise les lignes et récupère le nombre de colonnes de la 1ère session.
   */
  calculateStats() {
    if (this.sessions.length === 0) {
      this.totalRows = 0; this.totalColumns = 0; this.globalQuality = 0;
      return;
    }
    this.totalRows    = this.sessions.reduce((sum, s) => sum + s.rowCount, 0);
    this.totalColumns = this.sessions[0].columnCount; // Colonnes de la session la plus récente
    this.globalQuality = 85; // Valeur placeholder en attendant le calcul côté API
  }

  // ─── Navigation vers le rapport de nettoyage ──────────────────────────────

  /**
   * openCleaningReport — Navigue vers la page du rapport de nettoyage.
   * @param cleanedDatasetId ID du dataset nettoyé retourné par l'API
   */
  private openCleaningReport(cleanedDatasetId: number): void {
    this.router.navigate([
      '/workspaces', this.workspaceId, 'cleaned-dataset', cleanedDatasetId, 'report'
    ]).then((navigated) => {
      if (!navigated) this.toast.error('Could not open the cleaning report.');
    }).catch(() => this.toast.error('Could not open the cleaning report.'));
  }

  /**
   * openExistingCleaningReport — Récupère le rapport existant pour une session
   * et navigue vers le plus récent.
   * @param sessionId ID de la session d'analyse source
   */
  private openExistingCleaningReport(sessionId: number): void {
    this.cleanedDatasetService.getBySession(sessionId).subscribe({
      next: (datasets) => {
        // Filtrer pour ne garder que les datasets liés à cette session précise
        const matchingDatasets = (datasets ?? []).filter((dataset: any) =>
          (dataset.originalSessionId ?? dataset.OriginalSessionId) === sessionId
        );

        if (matchingDatasets.length === 0) {
          alert('No cleaning report available for this session.');
          return;
        }

        // Prendre le rapport le plus récent (trié par cleanedAt décroissant)
        const reportToOpen = matchingDatasets.sort((a: any, b: any) =>
          new Date(b.cleanedAt ?? b.CleanedAt ?? 0).getTime() -
          new Date(a.cleanedAt ?? a.CleanedAt ?? 0).getTime()
        )[0] as any;

        const cleanedDatasetId = reportToOpen?.id ?? reportToOpen?.Id;
        if (!cleanedDatasetId) {
          this.toast.error('A cleaning report exists, but it could not be opened.');
          return;
        }
        this.openCleaningReport(cleanedDatasetId);
      },
      error: (err) => {
        this.toast.error('Could not fetch the cleaning report for this session.');
      }
    });
  }

  // ─── Gestion des rôles ────────────────────────────────────────────────────

  /**
   * getUserRole — Détermine le rôle de l'utilisateur connecté dans ce workspace.
   * Priorité : currentUserRole (API) > ownerName > liste membres.
   * @returns 'Owner' | 'Editor' | 'Viewer' | ''
   */
  getUserRole(): string {
    if (!this.workspace) return '';
    if (this.workspace.currentUserRole) return this.workspace.currentUserRole;

    const currentUserName = localStorage.getItem('userName');
    if (!currentUserName) return '';

    if (this.workspace.ownerName?.toLowerCase() === currentUserName.toLowerCase()) return 'Owner';
    const member = this.members.find(m => m.userName?.toLowerCase() === currentUserName.toLowerCase());
    return member ? member.role : '';
  }

  /** @returns true si l'utilisateur connecté est propriétaire du workspace */
  isOwner(): boolean { return this.getUserRole().toLowerCase() === 'owner'; }

  /** @returns true si l'utilisateur est Viewer (droits lecture seule) */
  isViewer(): boolean { return this.getUserRole().toLowerCase() === 'viewer'; }

  /** @returns true si l'utilisateur peut modifier (Owner ou Editor) */
  canEdit(): boolean {
    const role = this.getUserRole().toLowerCase();
    return role === 'owner' || role === 'editor';
  }

  // ─── Helpers UI dynamiques ────────────────────────────────────────────────

  /** Texte du bouton d'action selon le rôle (Clean Data ou Open Report) */
  getReportActionTitle(): string { return this.canEdit() ? 'Clean Data' : 'Open Cleaning Report'; }
  /** Icône Material du bouton d'action selon le rôle */
  getReportActionIcon(): string  { return this.canEdit() ? 'auto_awesome' : 'description'; }
  /** Classe CSS du bouton d'action selon le rôle */
  getReportActionClass(): string { return this.canEdit() ? 'clean-btn' : 'report-btn'; }

  // ─── Navigation ───────────────────────────────────────────────────────────

  /** Retourne à la liste des workspaces */
  goBack() { this.router.navigate(['/workspaces']); }

  // ─── Upload de fichier CSV ────────────────────────────────────────────────

  /** Ouvre le modal d'upload si l'utilisateur a les droits d'édition */
  onUploadData() {
    if (!this.canEdit()) return;
    this.uploadSessionName = ''; this.selectedFile = null;
    this.uploadError = ''; this.showUploadModal = true;
  }

  /**
   * onFileSelected — Validation et stockage du fichier CSV sélectionné.
   * Accepte uniquement les fichiers .csv.
   */
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.name.endsWith('.csv')) {
        this.selectedFile = file;
        this.uploadError = '';
        // Pré-remplir le nom de session avec le nom du fichier (sans extension)
        if (!this.uploadSessionName) this.uploadSessionName = file.name.replace('.csv', '');
      } else {
        this.uploadError = 'Please select a valid CSV file.';
        this.selectedFile = null;
      }
    }
  }

  /** Confirme l'upload et crée la nouvelle session d'analyse via l'API */
  confirmUpload() {
    if (!this.canEdit()) return;
    if (!this.uploadSessionName || !this.selectedFile) {
      this.uploadError = 'Please provide a name and select a file.'; return;
    }
    this.isUploading = true; this.uploadError = '';
    this.sessionService.create({ sessionName: this.uploadSessionName, workspaceId: this.workspaceId }, this.selectedFile).subscribe({
      next: () => { this.isUploading = false; this.showUploadModal = false; this.loadData(); },
      error: (err) => { this.isUploading = false; this.uploadError = 'Upload failed. Please try again.'; }
    });
  }

  /** Annule l'upload et réinitialise l'état du modal */
  cancelUpload() {
    this.showUploadModal = false; this.uploadSessionName = '';
    this.selectedFile = null; this.isUploading = false; this.uploadError = '';
  }

  // ─── Invitation de membres ────────────────────────────────────────────────

  /** Ouvre le modal d'invitation et charge la liste de tous les utilisateurs */
  onInviteMember() {
    if (!this.isOwner()) return;
    this.inviteSearch = ''; this.selectedInviteUser = null;
    this.inviteRole = 'Viewer'; this.inviteError = ''; this.showInviteModal = true;
    this.authService.getUsers().subscribe({
      next: (users) => { this.allSystemUsers = users; this.filteredUsers = []; },
      error: () => { this.inviteError = 'Failed to load system users.'; }
    });
  }

  /**
   * onInviteSearchChange — Filtre les utilisateurs en temps réel.
   * Déclenché à chaque frappe dans le champ de recherche.
   * Exclut les membres déjà présents dans le workspace.
   */
  onInviteSearchChange() {
    if (!this.inviteSearch || this.inviteSearch.length < 2) { this.filteredUsers = []; return; }
    const search = this.inviteSearch.toLowerCase();
    this.filteredUsers = this.allSystemUsers.filter((u: any) =>
      u.userName.toLowerCase().includes(search) &&
      !this.members.some((m: any) => m.userId === u.id)
    ).slice(0, 5); // Limiter à 5 résultats pour l'ergonomie
  }

  /** Sélectionne un utilisateur dans la liste des suggestions */
  selectInviteUser(user: any) {
    this.selectedInviteUser = user; this.inviteSearch = user.userName;
    this.filteredUsers = []; this.inviteError = '';
  }

  /** Envoie l'invitation via l'API et recharge les membres après succès */
  confirmInvite() {
    if (!this.isOwner() || !this.selectedInviteUser) { this.inviteError = 'Please select a user from the list.'; return; }
    this.isInviting = true; this.inviteError = '';
    this.memberService.inviteMember({ workspaceId: this.workspaceId, userId: this.selectedInviteUser.id, role: this.inviteRole }).subscribe({
      next: () => {
        this.isInviting = false; this.showInviteModal = false;
        this.toast.success(`${this.selectedInviteUser?.userName} has been invited successfully!`);
        this.loadData();
      },
      error: (err: any) => { this.isInviting = false; this.inviteError = err.error?.message || 'Failed to send invitation.'; }
    });
  }

  /** Annule l'invitation et réinitialise l'état du modal */
  cancelInvite() {
    this.showInviteModal = false; this.inviteSearch = '';
    this.selectedInviteUser = null; this.isInviting = false; this.inviteError = '';
  }

  // ─── Suppression de membre ────────────────────────────────────────────────

  /** Ouvre le modal de confirmation de suppression (Owner seulement, sauf soi-même) */
  onRemoveMember(member: WorkspaceMemberDto) {
    if (!this.isOwner() || member.role?.toLowerCase() === 'owner') return;
    this.removingMemberId = member.id; this.removingMemberName = member.userName;
    this.removeMemberError = ''; this.showRemoveMemberModal = true;
  }

  /** Confirme la suppression du membre et recharge la liste */
  confirmRemoveMember() {
    if (!this.isOwner() || !this.removingMemberId) return;
    this.isRemovingMember = true; this.removeMemberError = '';
    this.memberService.delete(this.removingMemberId).subscribe({
      next: () => { this.isRemovingMember = false; this.showRemoveMemberModal = false; this.loadData(); },
      error: (err: any) => { this.isRemovingMember = false; this.removeMemberError = err.error?.message || 'Failed to remove member.'; }
    });
  }

  /** Annule la suppression de membre */
  cancelRemoveMember() {
    this.showRemoveMemberModal = false; this.removingMemberId = null;
    this.removingMemberName = ''; this.isRemovingMember = false; this.removeMemberError = '';
  }

  // ─── Métriques de qualité ─────────────────────────────────────────────────

  /**
   * viewMetrics — Affiche les métriques de qualité d'une session.
   * Si aucune métrique n'existe (404), déclenche une analyse automatique.
   */
  viewMetrics(session: AnalysisSession) {
    this.showMetricsModal = true; this.isLoadingMetrics = true;
    this.metricsError = ''; this.metricsSessionTitle = session.sessionName;
    this.selectedSessionMetrics = [];
    this.qualityService.getBySession(session.id).subscribe({
      next: (metrics) => { this.selectedSessionMetrics = metrics.sort((a, b) => a.position - b.position); this.isLoadingMetrics = false; },
      error: (err) => {
        // Si aucune métrique : lancer l'analyse automatiquement
        if (err.status === 404) this.analyzeSessionMetrics(session.id);
        else { this.metricsError = 'Error loading metrics. Please try again.'; this.isLoadingMetrics = false; }
      }
    });
  }

  /** Déclenche l'analyse de qualité pour une session et recharge les métriques */
  analyzeSessionMetrics(sessionId: number) {
    this.qualityService.analyzeSession({ analysisSessionId: sessionId }).subscribe({
      next: () => {
        this.qualityService.getBySession(sessionId).subscribe(metrics => {
          this.selectedSessionMetrics = metrics.sort((a, b) => a.position - b.position);
          this.isLoadingMetrics = false;
        });
      },
      error: () => { this.metricsError = 'Analysis failed. Please check the file format.'; this.isLoadingMetrics = false; }
    });
  }

  /** Ferme le modal des métriques et réinitialise les données */
  closeMetricsModal() { this.showMetricsModal = false; this.selectedSessionMetrics = []; this.metricsError = ''; }

  // ─── Nettoyage de données ─────────────────────────────────────────────────

  /**
   * cleanData — Action principale selon le rôle :
   *  • Owner/Editor → Ouvre le modal de nettoyage (créer un nouveau rapport)
   *  • Viewer       → Ouvre le rapport existant le plus récent
   */
  cleanData(session: any) {
    if (this.isCleaning || this.isDeleting) return;
    const sessionId   = session.id || session.Id;
    const sessionName = session.sessionName || session.SessionName || 'Dataset';
    if (this.canEdit()) {
      this.cleaningSessionId = sessionId;
      this.cleaningName = `Cleaned - ${sessionName}`;
      this.cleanError = ''; this.showCleanModal = true;
      return;
    }
    this.openExistingCleaningReport(sessionId);
  }

  /**
   * confirmClean — Envoie la requête de nettoyage à l'API.
   * Après succès : télécharge automatiquement le CSV et navigue vers le rapport.
   */
  confirmClean() {
    if (!this.canEdit() || !this.cleaningSessionId || !this.cleaningName.trim()) {
      this.cleanError = 'Dataset name is required.'; return;
    }
    this.isCleaning = true; this.cleanError = '';
    const request: CleaningRequestDto = { analysisSessionId: this.cleaningSessionId, name: this.cleaningName.trim() };
    this.cleanedDatasetService.cleanSession(request).subscribe({
      next: (result) => {
        this.isCleaning = false; this.showCleanModal = false;
        // Téléchargement automatique du dataset nettoyé
        this.cleanedDatasetService.downloadFile(result.id).subscribe({
          next: (blob) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `${result.name}.csv`;
            document.body.appendChild(a); a.click();
            window.URL.revokeObjectURL(url); document.body.removeChild(a);
          },
          error: (err) => console.error('Failed to auto-download dataset:', err)
        });
        this.openCleaningReport(result.id);
      },
      error: (err) => {
        this.isCleaning = false;
        this.cleanError = err.error?.message || 'Cleaning failed. Please wait or try again.';
      }
    });
  }

  /** Annule le nettoyage et réinitialise le modal */
  cancelClean() {
    this.showCleanModal = false; this.isCleaning = false;
    this.cleaningSessionId = null; this.cleaningName = ''; this.cleanError = '';
  }

  // ─── Suppression de session ───────────────────────────────────────────────

  /** Ouvre le modal de confirmation de suppression de session */
  deleteSession(session: AnalysisSession) {
    if (!this.canEdit()) return;
    this.deletingSessionId = session.id; this.deleteError = ''; this.showDeleteModal = true;
  }

  /** Confirme la suppression et recharge les sessions */
  confirmDelete() {
    if (!this.canEdit() || !this.deletingSessionId) return;
    this.isDeleting = true; this.deleteError = '';
    this.sessionService.delete(this.deletingSessionId).subscribe({
      next: () => { this.isDeleting = false; this.showDeleteModal = false; this.deletingSessionId = null; this.loadData(); },
      error: (err) => { this.isDeleting = false; this.deleteError = 'Failed to delete the session. Please try again.'; }
    });
  }

  /** Annule la suppression de session */
  cancelDelete() { this.showDeleteModal = false; this.deletingSessionId = null; this.isDeleting = false; this.deleteError = ''; }

  // ─── Renommage de session ─────────────────────────────────────────────────

  /** Ouvre le modal de renommage pré-rempli avec le nom actuel */
  renameSession(session: AnalysisSession) {
    if (!this.canEdit()) return;
    this.renamingSessionId = session.id; this.renameValue = session.sessionName;
    this.renameError = ''; this.showRenameModal = true;
  }

  /** Confirme le renommage et affiche un toast de succès */
  confirmRename() {
    if (!this.canEdit() || !this.renamingSessionId || !this.renameValue.trim()) {
      this.renameError = 'Session name cannot be empty.'; return;
    }
    this.isRenaming = true; this.renameError = '';
    const dto: AnalysisSessionUpdateDto = { sessionName: this.renameValue.trim() };
    this.sessionService.update(this.renamingSessionId, dto).subscribe({
      next: () => { this.isRenaming = false; this.showRenameModal = false; this.toast.success('Session renamed successfully!'); this.loadData(); },
      error: (err: any) => { this.isRenaming = false; this.renameError = err.error?.message || 'Failed to rename session.'; }
    });
  }

  /** Annule le renommage et ferme le modal */
  cancelRename() { this.showRenameModal = false; this.renamingSessionId = null; this.renameValue = ''; this.isRenaming = false; this.renameError = ''; }
}
