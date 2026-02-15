/**
 * ============================================================
 * FICHIER  : cleaning-report.component.ts
 * COMPOSANT: CleaningReportComponent
 * ROUTE    : /workspaces/:id/cleaned-dataset/:cleanedDatasetId/report
 *
 * RÔLE     : Page de rapport de nettoyage d'un dataset.
 *            Affiche les statistiques de nettoyage, les métriques
 *            de qualité (après nettoyage), les opérations effectuées,
 *            et les commentaires collaboratifs.
 *
 * FONCTIONNALITÉS :
 *  • Chargement du rapport de nettoyage depuis l'API
 *  • Calcul et affichage des opérations de nettoyage (JSON parsé)
 *  • Métriques de qualité par colonne (chargées ou générées auto)
 *  • Système de commentaires (CRUD complet, selon rôle)
 *  • Téléchargement du CSV nettoyé
 *  • Génération et téléchargement du rapport PDF (jsPDF + autoTable)
 *  • Suppression du rapport (Owner/Editor seulement)
 *
 * PATTERN Angular :
 *  • Gestion des rôles via getUserRole() basée sur currentUserRole
 *    retourné par le backend (Owner, Editor, Viewer)
 *  • DatePipe instancié manuellement pour formater les dates dans le PDF
 * ============================================================
 */
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CleanedDatasetService } from '../../../core/services/cleaned-dataset.service';
import { CleanedDataset, CleaningStats } from '../../../core/models/cleaned-dataset.model';
import { DataQualityService } from '../../../core/services/data-quality.service';
import { DataQualityMetric } from '../../../core/models/data-quality-metric.model';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { WorkspaceWithMembersDto } from '../../../core/models/workspace.model';
import { CommentaireService } from '../../../core/services/commentaire.service';
import { Commentaire, CommentaireDto } from '../../../core/models/commentaire.model';
import { AuthService } from '../../../core/services/auth.service';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DatePipe } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-cleaning-report',
  templateUrl: './cleaning-report.component.html',
  styleUrls: ['./cleaning-report.component.css']
})
/**
 * CleaningReportComponent — Rapport complet de nettoyage d'un dataset.
 * Accessible en lecture à tous les membres ; écriture réservée Owner/Editor.
 */
export class CleaningReportComponent implements OnInit {
  // ─── Identifiants de route ──────────────────────────────────────────────
  /** ID du workspace parent (paramètre :id dans l'URL) */
  workspaceId!: number;
  /** ID du dataset nettoyé (paramètre :cleanedDatasetId dans l'URL) */
  cleanedDatasetId!: number;

  // ─── Données principales ────────────────────────────────────────────────
  /** Dataset nettoyé complet retourné par l'API */
  cleanedDataset: CleanedDataset | null = null;
  /** Statistiques de nettoyage (Missing, Duplicates, Outliers, Format) */
  stats: CleaningStats | undefined = undefined;
  /** Métriques de qualité par colonne (triées par position) */
  metrics: DataQualityMetric[] = [];
  /** Compteurs d'opérations parsés depuis le JSON cleaningOperations */
  operationCounts: { [key: string]: number } = {};
  /** Workspace parent (pour la gestion des rôles et l'affichage) */
  workspace: WorkspaceWithMembersDto | null = null;
  /** Liste des commentaires associés à la session d'origine */
  comments: Commentaire[] = [];

  // ─── États de chargement et d'interface ─────────────────────────────────
  isLoading = true;             // Chargement initial du rapport
  isLoadingMetrics = true;      // Chargement des métriques de qualité
  isLoadingComments = false;    // Chargement des commentaires
  isAnalyzing = false;          // Analyse qualité en cours
  showComments = false;         // Panneau commentaires visible/masqué
  isSubmittingComment = false;  // Soumission d'un commentaire en cours
  isDeleting = false;           // Suppression du rapport en cours
  showDeleteModal = false;      // Modal de confirmation de suppression
  isGeneratingPDF = false;      // Génération PDF en cours
  isDownloadingCsv = false;     // Téléchargement CSV en cours

  // ─── Commentaires ────────────────────────────────────────────────────────
  /** Texte saisi dans le champ de nouveau commentaire */
  newCommentText = '';
  /** Commentaire en cours d'édition (null si aucun) */
  editingComment: Commentaire | null = null;
  /** Texte du commentaire en cours d'édition */
  editingCommentText = '';

  /**
   * Constructeur — Injection des dépendances.
   * @param route              Lecture des paramètres d'URL (:id, :cleanedDatasetId)
   * @param router             Navigation programmatique
   * @param cleanService       Récupération/suppression des datasets nettoyés
   * @param metricsService     Calcul et lecture des métriques de qualité
   * @param workspaceService   Récupération du workspace parent (pour les rôles)
   * @param commentairesService CRUD des commentaires de session
   * @param auth               Vérification de l'état de connexion
   * @param toast              Notifications toast (succès/erreur)
   */
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cleanService: CleanedDatasetService,
    private metricsService: DataQualityService,
    private workspaceService: WorkspaceService,
    private commentairesService: CommentaireService,
    private auth: AuthService,
    private toast: ToastService
  ) { }

  /**
   * ngOnInit — Vérifie l'authentification puis charge le rapport.
   * Redirige vers /login si l'utilisateur n'est pas connecté.
   */
  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) {
      this.auth.logout();
      this.router.navigate(['/']);
      return;
    }

    // S'abonner aux paramètres de route pour lire l'ID du workspace et du dataset
    this.route.params.subscribe(params => {
      this.workspaceId = +params['id'];
      this.cleanedDatasetId = +params['cleanedDatasetId'];
      this.loadReport();
    });
  }

  /**
   * loadReport — Charge le dataset nettoyé depuis l'API.
   * Après succès : parse les opérations, charge le workspace, les métriques et les commentaires.
   */
  loadReport(): void {
    this.isLoading = true;
    this.cleanService.getById(this.cleanedDatasetId).subscribe({
      next: (dataset) => {
        this.cleanedDataset = dataset;
        if (this.cleanedDataset) {
          this.stats = this.cleanedDataset.stats;
          this.parseCleaningOperations(); // Parser le JSON des opérations

          // Charger le workspace pour connaître le rôle de l'utilisateur
          this.workspaceService.getWorkspaceById(this.workspaceId).subscribe(ws => {
            this.workspace = ws;
          });

          this.loadMetrics();
          this.loadComments();
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading report', err);
        this.cleanedDataset = null;
        this.isLoading = false;
      }
    });
  }

  /**
   * parseCleaningOperations — Parse le JSON du champ cleaningOperations.
   * Compte chaque type d'opération (MissingImputation, DuplicatesRemoved, etc.).
   * En cas d'échec du parsing, utilise les valeurs des stats comme fallback.
   */
  parseCleaningOperations(): void {
    this.operationCounts = {
      MissingImputation: 0,
      DuplicatesRemoved: 0,
      OutliersHandled: 0,
      FormatIssuesFixed: 0
    };

    if (!this.cleanedDataset?.cleaningOperations || this.cleanedDataset.cleaningOperations.trim() === '') {
      if (this.stats) {
        this.operationCounts['MissingImputation'] = this.stats.totalMissingImputed || 0;
        this.operationCounts['DuplicatesRemoved'] = this.stats.totalDuplicatesRemoved || 0;
        this.operationCounts['OutliersHandled'] = this.stats.totalOutliersHandled || 0;
        this.operationCounts['FormatIssuesFixed'] = this.stats.totalFormatIssuesFixed || 0;
      }
      return;
    }

    try {
      const ops = JSON.parse(this.cleanedDataset.cleaningOperations);
      if (Array.isArray(ops)) {
        for (const op of ops) {
          const type = op.Type || '';
          switch (type) {
            case 'MissingImputation':
              this.operationCounts['MissingImputation']++;
              break;
            case 'DuplicateRemoval':
              if (op.AffectedRows !== undefined) {
                this.operationCounts['DuplicatesRemoved'] += op.AffectedRows;
              } else {
                this.operationCounts['DuplicatesRemoved']++;
              }
              break;
            case 'OutlierCorrection':
              this.operationCounts['OutliersHandled']++;
              break;
            case 'FormatStandardization':
              this.operationCounts['FormatIssuesFixed']++;
              break;
            default:
              const lowerType = type.toLowerCase();
              if (lowerType.includes('missing') || lowerType.includes('impute')) {
                this.operationCounts['MissingImputation']++;
              } else if (lowerType.includes('duplicate') || lowerType.includes('remove')) {
                this.operationCounts['DuplicatesRemoved']++;
              } else if (lowerType.includes('outlier') || lowerType.includes('correction')) {
                this.operationCounts['OutliersHandled']++;
              } else if (lowerType.includes('format') || lowerType.includes('standardization')) {
                this.operationCounts['FormatIssuesFixed']++;
              }
              break;
          }
        }
      }
    } catch (e) {
      if (this.stats) {
        this.operationCounts['MissingImputation'] = this.stats.totalMissingImputed || 0;
        this.operationCounts['DuplicatesRemoved'] = this.stats.totalDuplicatesRemoved || 0;
        this.operationCounts['OutliersHandled'] = this.stats.totalOutliersHandled || 0;
        this.operationCounts['FormatIssuesFixed'] = this.stats.totalFormatIssuesFixed || 0;
      }
    }
  }

  /** Retourne le nombre d'opérations pour une clé donnée (0 si absente) */
  getOperationCount(key: string): number {
    return this.operationCounts[key] || 0;
  }

  /**
   * loadMetrics — Charge les métriques de qualité du dataset nettoyé.
   * Si aucune métrique n'existe, déclenche automatiquement une analyse.
   */
  loadMetrics(): void {
    if (!this.cleanedDataset) return;
    this.isLoadingMetrics = true;
    this.metricsService.getByCleanedDataset(this.cleanedDataset.id).subscribe({
      next: (metrics) => {
        this.metrics = metrics.sort((a, b) => a.position - b.position);
        if (this.metrics.length === 0) {
          this.metricsService.analyzeCleanedDataset({ cleanedDatasetId: this.cleanedDataset!.id }).subscribe({
            next: () => {
              this.metricsService.getByCleanedDataset(this.cleanedDataset!.id).subscribe((newMetrics) => {
                this.metrics = newMetrics.sort((a, b) => a.position - b.position);
                this.isLoadingMetrics = false;
              });
            },
            error: () => {
              this.isLoadingMetrics = false;
            }
          });
        } else {
          this.isLoadingMetrics = false;
        }
      },
      error: (err) => {
        if (err?.status === 404 && this.cleanedDataset) {
          this.metricsService.analyzeCleanedDataset({ cleanedDatasetId: this.cleanedDataset.id }).subscribe({
            next: () => {
              this.metricsService.getByCleanedDataset(this.cleanedDataset!.id).subscribe({
                next: (newMetrics) => {
                  this.metrics = newMetrics.sort((a, b) => a.position - b.position);
                  this.isLoadingMetrics = false;
                },
                error: () => {
                  this.isLoadingMetrics = false;
                }
              });
            },
            error: () => {
              this.isLoadingMetrics = false;
            }
          });
          return;
        }

        this.isLoadingMetrics = false;
      }
    });
  }

  /** analyzeDataset — Déclenche manuellement l'analyse qualité du dataset nettoyé */
  analyzeDataset(): void {
    if (!this.canWriteComment() || !this.cleanedDataset) return;
    this.isAnalyzing = true;
    this.metricsService.analyzeCleanedDataset({ cleanedDatasetId: this.cleanedDataset.id }).subscribe({
      next: () => {
        this.loadMetrics();
        this.isAnalyzing = false;
        this.toast.success('Analysis completed successfully!');
      },
      error: () => {
        this.isAnalyzing = false;
      }
    });
  }

  /** Retourne à la page des sessions du workspace parent */
  goBack(): void {
    this.router.navigate([`/workspaces/${this.workspaceId}/sessions`]);
  }

  /**
   * getUserRole — Détermine le rôle de l'utilisateur dans ce workspace.
   * Priorité : currentUserRole (API) > ownerName > membres.
   * @returns 'Owner' | 'Editor' | 'Viewer' | ''
   */
  private getUserRole(): string {
    if (!this.workspace) return '';
    if (this.workspace.currentUserRole) return this.workspace.currentUserRole;

    const currentUserName = localStorage.getItem('userName') || '';
    if (!currentUserName) return '';

    if (this.workspace.ownerName?.toLowerCase() === currentUserName.toLowerCase()) {
      return 'Owner';
    }

    const member = this.workspace.members?.find(m => m.userName.toLowerCase() === currentUserName.toLowerCase());
    return member?.role || '';
  }

  /** @returns true si l'utilisateur peut créer/modifier des commentaires (Owner ou Editor) */
  canWriteComment(): boolean {
    const role = this.getUserRole();
    return role.toLowerCase() === 'owner' || role.toLowerCase() === 'editor';
  }

  /** @returns true si l'utilisateur peut modifier ce commentaire spécifique (Owner=tous, Editor=les siens) */
  canEditComment(comment: Commentaire): boolean {
    if (!this.canWriteComment()) return false;

    const role = this.getUserRole();
    const currentUserName = localStorage.getItem('userName') || '';

    if (role.toLowerCase() === 'owner') return true;

    if (role.toLowerCase() === 'editor' && this.workspace) {
      const currentMember = this.workspace.members?.find(m => m.userName.toLowerCase() === currentUserName.toLowerCase());
      if (currentMember && currentMember.userId === comment.userId) {
        return true;
      }
    }
    return false;
  }

  /** loadComments — Charge les commentaires liés à la session d'origine du dataset */
  loadComments(): void {
    if (!this.cleanedDataset) return;
    this.isLoadingComments = true;
    this.commentairesService.getBySession(this.cleanedDataset.originalSessionId).subscribe({
      next: (c) => {
        this.comments = c;
        this.isLoadingComments = false;
      },
      error: () => {
        this.isLoadingComments = false;
      }
    });
  }

  /** Getter calculé : nombre total de commentaires (affiché dans le badge) */
  get commentsCount(): number {
    return this.comments.length;
  }

  /** Affiche/masque le panneau de commentaires. Charge les commentaires si nécessaire. */
  toggleComments(): void {
    this.showComments = !this.showComments;
    if (this.showComments && this.comments.length === 0 && !this.isLoadingComments) {
      this.loadComments();
    }
  }

  /** Soumet un nouveau commentaire via l'API et recharge la liste */
  addComment(): void {
    if (!this.canWriteComment() || !this.cleanedDataset || !this.newCommentText.trim()) return;

    this.isSubmittingComment = true;
    const dto: CommentaireDto = {
      id: 0,
      analysisSessionId: this.cleanedDataset.originalSessionId,
      contenu: this.newCommentText.trim()
    };

    this.commentairesService.create(dto).subscribe({
      next: () => {
        this.newCommentText = '';
        this.loadComments();
        this.isSubmittingComment = false;
        this.toast.success('Comment posted.');
      },
      error: () => {
        this.isSubmittingComment = false;
        this.toast.error('Failed to post comment.');
      }
    });
  }

  /** Place un commentaire en mode édition */
  startEditComment(comment: Commentaire): void {
    this.editingComment = comment;
    this.editingCommentText = comment.contenu;
  }

  /** Annule l'édition d'un commentaire */
  cancelEditComment(): void {
    this.editingComment = null;
    this.editingCommentText = '';
  }

  /** Enregistre les modifications d'un commentaire via l'API */
  saveEditComment(): void {
    if (!this.canWriteComment() || !this.editingComment || !this.editingCommentText.trim()) return;

    this.isSubmittingComment = true;
    const dto: CommentaireDto = {
      id: this.editingComment.id,
      analysisSessionId: this.editingComment.analysisSessionId,
      contenu: this.editingCommentText.trim()
    };

    this.commentairesService.update(this.editingComment.id, dto).subscribe({
      next: () => {
        this.cancelEditComment();
        this.loadComments();
        this.isSubmittingComment = false;
        this.toast.success('Comment updated.');
      },
      error: () => {
        this.isSubmittingComment = false;
        this.toast.error('Failed to update comment.');
      }
    });
  }

  /** Supprime un commentaire par son ID et recharge la liste */
  deleteComment(commentId: number): void {
    this.commentairesService.delete(commentId).subscribe({
      next: () => {
        this.loadComments();
        this.toast.success('Comment deleted.');
      }
    });
  }

  /**
   * getCommentAuthor — Résout le nom d'affichage d'un auteur depuis son userId.
   * Cherche d'abord dans l'Owner, puis dans la liste des membres.
   * Fallback : les 8 premiers caractères du GUID.
   */
  getCommentAuthor(userId: string): string {
    if (!this.workspace) return userId.length > 8 ? userId.substring(0, 8) + '...' : userId;

    if (this.workspace.ownerId === userId && this.workspace.ownerName) {
      return this.workspace.ownerName;
    }

    const member = this.workspace.members?.find(m => m.userId === userId);
    if (member && member.userName) {
      return member.userName;
    }

    return userId.length > 8 ? userId.substring(0, 8) + '...' : userId;
  }

  /** Ouvre le modal de confirmation de suppression du rapport */
  confirmDelete(): void {
    if (!this.canWriteComment()) return;
    this.showDeleteModal = true;
  }

  /** Ferme le modal de confirmation sans supprimer */
  cancelDelete(): void {
    this.showDeleteModal = false;
  }

  /** Supprime définitivement le rapport et redirige vers la page des sessions */
  deleteReport(): void {
    if (!this.canWriteComment() || !this.cleanedDataset) return;
    this.isDeleting = true;
    this.cleanService.delete(this.cleanedDatasetId).subscribe({
      next: () => {
        this.isDeleting = false;
        this.showDeleteModal = false;
        this.toast.success('Report deleted successfully.');
        this.router.navigate([`/workspaces/${this.workspaceId}`]);
      },
      error: () => {
        this.isDeleting = false;
        this.showDeleteModal = false;
      }
    });
  }

  /**
   * downloadCleanedCsv — Télécharge le fichier CSV du dataset nettoyé.
   * Crée un lien <a> temporaire dans le DOM pour déclencher le téléchargement.
   */
  downloadCleanedCsv(): void {
    if (!this.cleanedDataset || this.isDownloadingCsv) return;

    this.isDownloadingCsv = true;
    this.cleanService.downloadFile(this.cleanedDataset.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        const safeName = (this.cleanedDataset?.name || 'cleaned-dataset').trim() || 'cleaned-dataset';

        anchor.href = url;
        anchor.download = `${safeName}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
        this.isDownloadingCsv = false;
      },
      error: () => {
        this.isDownloadingCsv = false;
      }
    });
  }

  /**
   * downloadReportPDF — Génère un rapport PDF complet avec jsPDF + autoTable.
   * Contenu : Résumé, Opérations, Statistiques, Métriques de qualité par colonne.
   * Le PDF est sauvegardé localement via doc.save().
   */
  downloadReportPDF(): void {
    if (!this.cleanedDataset) return;

    this.isGeneratingPDF = true;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const datePipe = new DatePipe('en-US');

    // Helper for table colors
    const primaryRGB: [number, number, number] = [79, 70, 229]; // Indigo
    const slateRGB: [number, number, number] = [71, 85, 105]; // Slate

    // 1. SIMPLE HEADER
    doc.setFontSize(22);
    doc.setTextColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
    doc.setFont('helvetica', 'bold');
    doc.text('Cleaning Quality Report', margin, 25);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(`Dataset: ${this.cleanedDataset.name}`, margin, 32);
    const genDate = datePipe.transform(new Date(), 'dd/MM/yyyy HH:mm') || '';
    doc.text(`Report generated on ${genDate}`, margin, 37);

    // Line separator
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, 42, pageWidth - margin, 42);

    let currentY = 50;

    // 2. DATASET SUMMARY
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Dataset Summary', margin, currentY);

    autoTable(doc, {
      startY: currentY + 5,
      margin: { left: margin, right: margin },
      head: [['Metric', 'Value']],
      body: [
        ['Original Row Count', (this.stats?.originalRowCount || 0).toString()],
        ['Cleaned Row Count', this.cleanedDataset.rowsCount.toString()],
        ['Total Columns', this.cleanedDataset.columnsCount.toString()],
        ['Processing Date', datePipe.transform(this.cleanedDataset.cleanedAt, 'dd/MM/yyyy HH:mm') || '']
      ],
      theme: 'grid',
      headStyles: { fillColor: primaryRGB, textColor: 255 },
      styles: { fontSize: 10, cellPadding: 3 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 3. CLEANING OPERATIONS
    doc.setFontSize(14);
    doc.text('2. Cleaning Operations', margin, currentY);

    autoTable(doc, {
      startY: currentY + 5,
      margin: { left: margin, right: margin },
      head: [['Operation Type', 'Impacted Count']],
      body: [
        ['Missing Values Imputed', this.getOperationCount("MissingImputation").toString()],
        ['Duplicates Removed', this.getOperationCount("DuplicatesRemoved").toString()],
        ['Outliers Handled', this.getOperationCount("OutliersHandled").toString()],
        ['Format Issues Fixed', this.getOperationCount("FormatIssuesFixed").toString()]
      ],
      theme: 'grid',
      headStyles: { fillColor: slateRGB, textColor: 255 },
      styles: { fontSize: 10, cellPadding: 3 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 4. CLEANING STATISTICS (From Data Model)
    if (this.stats) {
      doc.setFontSize(14);
      doc.text('3. Cleaning Statistics', margin, currentY);

      autoTable(doc, {
        startY: currentY + 5,
        margin: { left: margin, right: margin },
        head: [['Statistical Metric', 'Result']],
        body: [
          ['Total Missing Imputed', this.stats.totalMissingImputed.toString()],
          ['Total Duplicates Removed', this.stats.totalDuplicatesRemoved.toString()],
          ['Total Outliers Handled', this.stats.totalOutliersHandled.toString()],
          ['Total Format Issues Fixed', this.stats.totalFormatIssuesFixed.toString()]
        ],
        theme: 'grid',
        headStyles: { fillColor: slateRGB, textColor: 255 },
        styles: { fontSize: 10, cellPadding: 3 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // 5. DETAILED QUALITY METRICS (AFTER CLEANING)
    if (this.metrics && this.metrics.length > 0) {
      if (currentY > 180) { doc.addPage(); currentY = 20; }

      doc.setFontSize(14);
      doc.text('4. Data Quality Metrics (After Cleaning)', margin, currentY);

      autoTable(doc, {
        startY: currentY + 5,
        margin: { left: margin, right: margin },
        head: [['Column Name', 'Type', 'Missing', 'Duplicates', 'Score']],
        body: this.metrics.map(m => [
          m.columnName,
          m.dataType,
          m.missingValues.toString(),
          m.duplicateValues.toString(),
          `${Math.round(m.qualityScore * 100)}%`
        ]),
        theme: 'striped',
        headStyles: { fillColor: primaryRGB, textColor: 255 },
        styles: { fontSize: 9 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            const scoreText = data.cell.text[0] || '0%';
            const score = parseInt(scoreText.replace('%', ''));
            if (score >= 90) data.cell.styles.textColor = [22, 163, 74];
            else if (score < 70) data.cell.styles.textColor = [220, 38, 38];
          }
        }
      });
    }

    // FOOTER
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, 285, { align: 'center' });
      doc.text('DataHealthCheck - Professional Cleaning Report', margin, 285);
    }

    doc.save(`CleaningReport_${this.cleanedDataset.name.replace(/\s+/g, '_')}.pdf`);
    this.isGeneratingPDF = false;
  }
}
