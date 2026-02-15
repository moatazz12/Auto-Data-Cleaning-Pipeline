/**
 * ============================================================
 * FICHIER  : workspace-list.component.ts
 * COMPOSANT: WorkspaceListComponent
 * ROUTE    : /workspaces
 *
 * RÔLE     : Page de gestion des workspaces.
 *            Affiche la liste de tous les workspaces (possédés + partagés)
 *            avec filtres, pagination, et opérations CRUD complètes.
 *
 * FONCTIONNALITÉS :
 *  • Lecture    : Liste des workspaces avec tri par date (+ récent en premier)
 *  • Filtres    : Recherche par nom, description ou propriétaire
 *  • Pagination : 6 workspaces par page
 *  • Création   : Modal + formulaire réactif (ReactiveFormsModule)
 *  • Modification: Modal + formulaire pré-rempli (Owner seulement)
 *  • Suppression: Modal de confirmation (Owner seulement)
 *  • Rôles      : Détection du rôle de l'utilisateur (Owner/Editor/Viewer)
 *
 * SÉCURITÉ :
 *  Si l'utilisateur tente de modifier/supprimer un workspace
 *  dont il n'est pas Owner → message d'avertissement affiché.
 * ============================================================
 */
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

// Services
import { WorkspaceService } from '../../../core/services/workspace.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

// Modèles
import { WorkspaceWithMembersDto } from '../../../core/models/workspace.model';

/**
 * FilterType — Enumération des critères de filtre disponibles.
 * Permet à l'utilisateur de cibler sa recherche sur un champ spécifique.
 */
enum FilterType {
  All = 'All',         // Recherche sur tous les champs
  Name = 'Name',        // Recherche uniquement sur le nom
  Description = 'Description', // Recherche sur la description
  Owner = 'Owner'        // Recherche sur le propriétaire
}

@Component({
  selector: 'app-workspace-list',
  templateUrl: './workspace-list.component.html',
  styleUrls: ['./workspace-list.component.css']
})
export class WorkspaceListComponent implements OnInit {

  // ─── Liste des workspaces ──────────────────────────────────────────────────
  workspaces: WorkspaceWithMembersDto[] = [];          // Tous les workspaces chargés
  filteredWorkspaces: WorkspaceWithMembersDto[] = [];  // Workspaces après filtrage

  // ─── État de chargement ────────────────────────────────────────────────────
  isLoading = true;
  userDisplayName = 'there'; // Nom affiché dans la sidebar

  // ─── Filtres et recherche ──────────────────────────────────────────────────
  filterType: FilterType = FilterType.All; // Critère de filtre actif
  searchText = '';                          // Texte de recherche saisi
  FilterType = FilterType;                  // Exposer l'enum au template HTML

  // ─── Bannière d'avertissement de permission ────────────────────────────────
  // Affichée si un Editor/Viewer tente de modifier ou supprimer un workspace
  permissionWarning = '';

  // ─── Pagination ────────────────────────────────────────────────────────────
  currentPage = 1;                  // Page actuellement affichée
  readonly itemsPerPage = 6;        // Nombre de workspaces par page

  // ─── Modal de création ────────────────────────────────────────────────────
  showCreateModal = false;          // true → modal visible
  isCreating = false;               // true → requête API en cours (désactive le bouton)
  createForm: FormGroup;            // Formulaire réactif Angular

  // ─── Modal de modification ────────────────────────────────────────────────
  showEditModal = false;
  isSaving = false;
  editForm: FormGroup;
  editingWorkspaceId: number | null = null; // ID du workspace en cours de modification

  // ─── Modal de suppression ─────────────────────────────────────────────────
  showDeleteModal = false;
  isDeleting = false;
  deletingWorkspace: WorkspaceWithMembersDto | null = null; // Workspace à supprimer

  constructor(
    private workspaceService: WorkspaceService,
    private fb: FormBuilder,        // FormBuilder — construit les formulaires réactifs
    private authService: AuthService,
    private router: Router,
    private toast: ToastService
  ) {
    this.userDisplayName = localStorage.getItem('displayName') || 'there';

    // Initialisation du formulaire de CRÉATION
    // Validators.required → le champ "name" est obligatoire
    this.createForm = this.fb.group({
      name: ['', Validators.required], // Champ obligatoire
      description: ['']                       // Champ optionnel
    });

    // Initialisation du formulaire de MODIFICATION (même structure)
    this.editForm = this.fb.group({
      name: ['', Validators.required],
      description: ['']
    });
  }

  /**
   * ngOnInit — Chargement initial des workspaces au démarrage du composant.
   */
  ngOnInit(): void {
    this.loadWorkspaces();
  }

  // ─── CHARGEMENT DES DONNÉES ───────────────────────────────────────────────

  /**
   * Charge les workspaces possédés ET partagés en parallèle (forkJoin).
   * Les fusionne, supprime les doublons et trie par date de création.
   */
  loadWorkspaces(): void {
    this.isLoading = true;
    this.permissionWarning = '';

    forkJoin({
      owned: this.workspaceService.getWorkspaces(),       // Workspaces Owner
      shared: this.workspaceService.getSharedWorkspaces()  // Workspaces Membre
    }).subscribe({
      next: ({ owned, shared }) => {
        // Fusionner et dédupliquer (un même workspace ne doit apparaître qu'une fois)
        const all = [...owned, ...shared];
        const unique = Array.from(new Map(all.map(item => [item.id, item])).values());

        // Trier par date de création (le plus récent en premier)
        this.workspaces = unique.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur chargement workspaces:', err);
        this.isLoading = false;
      }
    });
  }

  // ─── GESTION DES RÔLES ────────────────────────────────────────────────────

  /**
   * Détermine le rôle de l'utilisateur connecté dans un workspace donné.
   * Priorité : currentUserRole (retourné par l'API) > comparaison locale.
   * @param ws → Le workspace à analyser
   * @returns  → "Owner", "Editor", "Viewer" ou ""
   */
  getUserRole(ws: WorkspaceWithMembersDto): string {
    if (ws.currentUserRole) return ws.currentUserRole;

    const currentUserName = localStorage.getItem('userName') || '';
    if (!currentUserName) return '';

    // Vérifier si l'utilisateur est l'Owner en comparant les noms
    if (ws.ownerName?.toLowerCase() === currentUserName.toLowerCase()) return 'Owner';

    // Sinon, chercher dans la liste des membres
    const member = ws.members?.find(
      m => m.userName?.toLowerCase() === currentUserName.toLowerCase()
    );
    return member?.role || '';
  }

  /**
   * Vérifie si l'utilisateur connecté peut modifier/supprimer ce workspace.
   * Seul l'Owner peut effectuer ces actions.
   * @param ws → Workspace à vérifier
   * @returns  → true si Owner, false sinon
   */
  canManage(ws: WorkspaceWithMembersDto): boolean {
    return this.getUserRole(ws).toLowerCase() === 'owner';
  }

  // ─── FILTRES ET RECHERCHE ─────────────────────────────────────────────────

  /** Change le critère de filtre actif et réapplique la recherche */
  setFilterType(type: FilterType): void {
    this.filterType = type;
    this.currentPage = 1; // Retour à la première page après changement de filtre
    this.applyFilters();
  }

  /** Déclenché à chaque frappe dans le champ de recherche */
  onSearchChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  /** Vide le champ de recherche et réaffiche tous les workspaces */
  clearSearch(): void {
    this.searchText = '';
    this.currentPage = 1;
    this.applyFilters();
  }

  /**
   * Applique le filtre de recherche sur la liste des workspaces.
   * Si searchText est vide → affiche tous les workspaces.
   * Sinon → filtre selon le critère sélectionné (FilterType).
   */
  applyFilters(): void {
    if (!this.searchText.trim()) {
      this.filteredWorkspaces = this.workspaces; // Pas de filtre → affiche tout
      return;
    }

    const searchLower = this.searchText.toLowerCase().trim();
    this.filteredWorkspaces = this.workspaces.filter(ws => {
      const nameMatch = ws.name.toLowerCase().includes(searchLower);
      const descMatch = (ws.description || '').toLowerCase().includes(searchLower);
      const ownerMatch = (ws.ownerName || '').toLowerCase().includes(searchLower);

      // Appliquer le bon critère de filtre selon FilterType
      switch (this.filterType) {
        case FilterType.Name: return nameMatch;
        case FilterType.Description: return descMatch;
        case FilterType.Owner: return ownerMatch;
        default: return nameMatch || descMatch || ownerMatch;
      }
    });
  }

  // ─── PAGINATION ───────────────────────────────────────────────────────────

  /** Calcule le nombre total de pages selon le nombre de workspaces filtrés */
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredWorkspaces.length / this.itemsPerPage));
  }

  /** Retourne uniquement les workspaces de la page courante */
  get paginatedWorkspaces(): WorkspaceWithMembersDto[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredWorkspaces.slice(start, start + this.itemsPerPage);
  }

  /** Génère le tableau des numéros de pages [1, 2, 3, ...] */
  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  /** Navigue vers une page spécifique */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  // ─── NAVIGATION ───────────────────────────────────────────────────────────

  /**
   * Ouvre le détail d'un workspace en naviguant vers /workspaces/{id}/sessions.
   * Ignore les clics sur les boutons d'action (Éditer, Supprimer).
   */
  openWorkspace(id: number, event: Event): void {
    const target = event.target as HTMLElement;
    // Vérifier que le clic n'est pas sur un bouton d'action
    if (target.closest('.action-btn') || target.closest('.ghost-btn-wrapper')) return;
    this.router.navigate(['/workspaces', id, 'sessions']);
  }

  // ─── CREATE : Création d'un workspace ────────────────────────────────────

  /** Affiche le modal de création */
  createWorkspace(): void {
    this.showCreateModal = true;
  }

  /** Ferme le modal de création et réinitialise le formulaire */
  closeCreateModal(): void {
    this.showCreateModal = false;
    this.createForm.reset();
  }

  /**
   * Soumet le formulaire de création.
   * Vérifie la validité du formulaire avant l'envoi (Validators.required).
   * Après succès → ferme le modal et recharge la liste.
   */
  createWorkspaceSubmit(): void {
    if (this.createForm.invalid) return; // Ne pas soumettre si le formulaire est invalide

    this.isCreating = true;
    this.workspaceService.createWorkspace(this.createForm.value).subscribe({
      next: () => {
        this.isCreating = false;
        this.closeCreateModal();
        this.toast.success('Workspace créé avec succès !');
        // Délai pour laisser le toast s'afficher avant de recharger la liste
        setTimeout(() => {
          this.searchText = '';
          this.filterType = FilterType.All;
          this.loadWorkspaces();
        }, 300);
      },
      error: (err) => {
        console.error('Erreur création workspace:', err);
        this.toast.error('Erreur lors de la création du workspace.');
        this.isCreating = false;
      }
    });
  }

  // ─── EDIT : Modification d'un workspace ──────────────────────────────────

  /**
   * Ouvre le modal d'édition pour un workspace.
   * Vérifie les permissions : seul l'Owner peut éditer.
   * Si l'utilisateur n'est pas Owner → affiche un message d'avertissement.
   */
  openEditModal(workspace: WorkspaceWithMembersDto, event: Event): void {
    event.stopPropagation(); // Éviter de déclencher openWorkspace en même temps

    if (!this.canManage(workspace)) {
      // Afficher le message d'erreur de permission pendant 4 secondes
      this.permissionWarning = "You cannot edit this workspace because you are not the Owner.";
      setTimeout(() => this.permissionWarning = '', 4000);
      return;
    }

    this.permissionWarning = '';
    this.editingWorkspaceId = workspace.id;

    // Pré-remplir le formulaire avec les valeurs actuelles du workspace
    this.editForm.patchValue({
      name: workspace.name,
      description: workspace.description
    });
    this.showEditModal = true;
  }

  /** Ferme le modal d'édition et réinitialise l'état */
  closeEditModal(): void {
    this.showEditModal = false;
    this.editingWorkspaceId = null;
    this.editForm.reset();
  }

  /**
   * Soumet le formulaire de modification.
   * Envoie les nouvelles valeurs au backend via WorkspaceService.updateWorkspace().
   * Après succès → ferme le modal et recharge la liste.
   */
  saveWorkspaceSubmit(): void {
    if (this.editForm.invalid || !this.editingWorkspaceId) return;

    this.isSaving = true;
    const payload = {
      id: this.editingWorkspaceId,
      ...this.editForm.value // Spread : { name, description }
    };

    this.workspaceService.updateWorkspace(this.editingWorkspaceId, payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.closeEditModal();
        this.toast.success('Workspace modifié avec succès !');
        setTimeout(() => this.loadWorkspaces(), 300);
      },
      error: (err) => {
        console.error('Erreur modification workspace:', err);
        this.toast.error('Erreur lors de la modification.');
        this.isSaving = false;
      }
    });
  }

  // ─── DELETE : Suppression d'un workspace ─────────────────────────────────

  /**
   * Affiche le modal de confirmation de suppression.
   * Vérifie les permissions : seul l'Owner peut supprimer.
   */
  deleteWorkspace(workspace: WorkspaceWithMembersDto, event: Event): void {
    event.stopPropagation();

    if (!this.canManage(workspace)) {
      this.permissionWarning = "You cannot delete this workspace because you are not the Owner.";
      setTimeout(() => this.permissionWarning = '', 4000);
      return;
    }

    this.permissionWarning = '';
    this.deletingWorkspace = workspace;
    this.showDeleteModal = true;
  }

  /** Ferme le modal de suppression sans supprimer */
  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.deletingWorkspace = null;
  }

  /**
   * Confirme et exécute la suppression du workspace.
   * Après succès → ferme le modal et recharge la liste.
   */
  confirmDelete(): void {
    if (!this.deletingWorkspace) return;

    this.isDeleting = true;
    this.workspaceService.deleteWorkspace(this.deletingWorkspace.id).subscribe({
      next: () => {
        this.isDeleting = false;
        this.closeDeleteModal();
        this.toast.success('Workspace supprimé avec succès.');
        setTimeout(() => this.loadWorkspaces(), 300);
      },
      error: (err) => {
        console.error('Erreur suppression workspace:', err);
        this.toast.error('Erreur lors de la suppression.');
        this.isDeleting = false;
      }
    });
  }

  // ─── UTILITAIRES ──────────────────────────────────────────────────────────

  /** Déconnecte l'utilisateur et redirige vers /login */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  /**
   * Retourne une classe CSS de couleur différente pour chaque carte.
   * Les couleurs alternent en cycle sur les 5 couleurs définies.
   * @param index → Position du workspace dans la liste
   */
  getCardClass(index: number): string {
    const colors = ['card-violet', 'card-blue', 'card-navy', 'card-cyan', 'card-silver'];
    return colors[index % colors.length];
  }

  /**
   * Retourne le placeholder du champ de recherche selon le filtre actif.
   * Améliore l'expérience utilisateur (UX).
   */
  getSearchPlaceholder(): string {
    switch (this.filterType) {
      case FilterType.Name: return 'Rechercher par nom...';
      case FilterType.Description: return 'Rechercher par description...';
      case FilterType.Owner: return 'Rechercher par propriétaire...';
      default: return 'Rechercher par nom, description ou propriétaire...';
    }
  }
}
