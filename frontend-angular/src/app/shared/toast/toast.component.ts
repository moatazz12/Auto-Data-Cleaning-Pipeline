/**
 * ============================================================
 * FICHIER    : toast.component.ts
 * COMPOSANT  : ToastComponent
 * SÉLECTEUR  : <app-toast>
 * EMPLACEMENT: app.component.html (niveau racine de l'application)
 *
 * RÔLE     : Composant d'affichage des notifications pop-up (Toasts).
 *            Écoute le flux de ToastService et affiche chaque notification
 *            en bas à droite de l'écran avec une animation d'entrée/sortie.
 *
 * FONCTIONNEMENT :
 *  • Ce composant est placé UNE SEULE FOIS dans app.component.html
 *  • Il est ainsi disponible sur TOUTES les pages (Dashboard, Workspaces, etc.)
 *  • Il s'abonne à toastService.toasts$ via le pipe | async
 *  • Quand un toast est ajouté, Angular détecte le changement et le rend
 *
 * DESIGN :
 *  • Styles entièrement auto-contenus (dans styles: [...]) pour éviter
 *    tout conflit avec le CSS global et garantir l'affichage
 *  • z-index: 999999 → toujours au-dessus de tout (modals, overlays)
 *  • Animations CSS : slide-in depuis la droite + fade
 * ============================================================
 */
import { Component, OnInit, NgZone } from '@angular/core';
import { Toast, ToastService } from '../../core/services/toast.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-toast',

  // ─── Template HTML Inline ──────────────────────────────────────────────────
  // Le template est inline pour rester cohérent avec les styles auto-contenus.
  // *ngFor itère sur la liste de toasts émise par le service (réactif).
  // Le pipe | async gère automatiquement l'abonnement et le désabonnement RxJS.
  template: `
    <div class="my-toast-container">
      <div
        *ngFor="let t of toasts$ | async"
        class="my-toast"
        [ngClass]="'my-toast-' + t.type"
        [class.my-toast-exit]="t.exiting"
      >
        <!-- Icône Material Symbols selon le type du toast -->
        <span class="material-symbols-rounded my-toast-icon">{{ getIcon(t.type) }}</span>

        <!-- Message à afficher à l'utilisateur -->
        <span class="my-toast-message">{{ t.message }}</span>

        <!-- Bouton de fermeture manuelle (avant l'auto-dismiss de 3.5s) -->
        <button class="my-toast-close" (click)="toastService.dismiss(t.id)">✕</button>
      </div>
    </div>
  `,

  // ─── Styles Auto-Contenus ──────────────────────────────────────────────────
  // Les styles sont déclarés ICI (et non dans styles.css) pour garantir
  // leur application même si Angular isole les styles par composant (ViewEncapsulation).
  styles: [`
    /* Conteneur principal : fixé en bas à droite, z-index maximal */
    .my-toast-container {
      position: fixed !important;
      bottom: 32px !important;
      right: 32px !important;
      z-index: 999999 !important; /* Au-dessus de tout (modals, overlays) */
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none; /* Le conteneur ne bloque pas les clics */
    }

    /* Style de base commun à tous les toasts */
    .my-toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      border-radius: 14px;
      font-size: 14px;
      font-weight: 600;
      min-width: 280px;
      max-width: 380px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25);
      pointer-events: all; /* Le toast lui-même est cliquable (bouton fermeture) */
      animation: toastIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      color: #fff;
    }

    /* Couleurs selon le type — correspondent aux méthodes du ToastService */
    .my-toast-success { background: linear-gradient(135deg, #10b981, #059669); } /* Vert */
    .my-toast-error   { background: linear-gradient(135deg, #ef4444, #dc2626); } /* Rouge */
    .my-toast-info    { background: linear-gradient(135deg, #6366f1, #4f46e5); } /* Violet */
    .my-toast-warning { background: linear-gradient(135deg, #f59e0b, #d97706); } /* Orange */

    /* Animation de sortie déclenchée quand exiting = true */
    .my-toast-exit { animation: toastOut 0.3s ease forwards; }

    .my-toast-icon    { font-size: 20px; flex-shrink: 0; }
    .my-toast-message { flex: 1; line-height: 1.4; }

    /* Bouton de fermeture manuelle */
    .my-toast-close {
      background: rgba(255,255,255,0.2);
      border: none;
      color: #fff;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .my-toast-close:hover { background: rgba(255,255,255,0.35); }

    /* Animation d'entrée : glisse depuis la droite + apparition */
    @keyframes toastIn {
      from { opacity: 0; transform: translateX(60px) scale(0.85); }
      to   { opacity: 1; transform: translateX(0)    scale(1); }
    }

    /* Animation de sortie : glisse vers la droite + disparition */
    @keyframes toastOut {
      from { opacity: 1; transform: translateX(0); }
      to   { opacity: 0; transform: translateX(60px); }
    }
  `]
})
export class ToastComponent implements OnInit {

  // ─── Propriétés ───────────────────────────────────────────────────────────

  /**
   * Observable sur la liste des toasts actifs.
   * Le template s'y abonne via | async → mis à jour automatiquement.
   */
  toasts$: Observable<Toast[]>;

  constructor(
    public toastService: ToastService, // Public : accessible depuis le template HTML
    private zone: NgZone               // NgZone : garantit que les changements déclenchent la détection Angular
  ) {
    // On s'abonne au flux du service dès la construction du composant
    this.toasts$ = toastService.toasts$;
  }

  /**
   * ngOnInit — Hook de cycle de vie Angular.
   * Appelé une fois après l'initialisation du composant.
   */
  ngOnInit() {
    console.log('[ToastComponent] Actif et prêt à afficher les notifications.');
  }

  // ─── Méthodes ─────────────────────────────────────────────────────────────

  /**
   * Retourne le nom de l'icône Material Symbols selon le type du toast.
   * Ces icônes sont chargées depuis Google Fonts (Material Symbols Rounded).
   * @param type → 'success' | 'error' | 'warning' | 'info'
   * @returns    → Nom de l'icône (ex: 'check_circle')
   */
  getIcon(type: string): string {
    switch (type) {
      case 'success': return 'check_circle'; // Cercle vert avec coche
      case 'error': return 'error';         // Cercle rouge avec croix
      case 'warning': return 'warning';       // Triangle orange
      default: return 'info';          // Cercle bleu
    }
  }
}
