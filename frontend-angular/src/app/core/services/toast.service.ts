/**
 * ============================================================
 * FICHIER  : toast.service.ts
 * SERVICE  : ToastService
 *
 * RÔLE     : Service global de gestion des notifications pop-up (Toasts).
 *            Fournit des méthodes simples pour afficher des messages
 *            colorés à l'utilisateur (succès, erreur, info, avertissement)
 *            sans bloquer l'interface (contrairement à window.alert).
 *
 * FONCTIONNEMENT :
 *  1. Un composant (ex: WorkspaceList) appelle this.toast.success('Message')
 *  2. Le service ajoute le toast à la liste (_toasts$ BehaviorSubject)
 *  3. Le ToastComponent, abonné via toasts$ | async, affiche la notif
 *  4. Après 3.5 secondes, le toast disparaît automatiquement (auto-dismiss)
 *
 * UTILISÉ PAR :
 *  • WorkspaceListComponent (Créer, Modifier, Supprimer un workspace)
 *  • WorkspaceDetailComponent (Analyse, session, membres)
 *  • CleaningReportComponent (Export, rapport de nettoyage)
 * ============================================================
 */
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Interface Toast — Représente la structure d'une notification.
 * Chaque toast a un identifiant unique, un type (couleur) et un message.
 */
export interface Toast {
  id: number;                                    // Identifiant unique auto-incrémenté
  type: 'success' | 'error' | 'info' | 'warning'; // Détermine la couleur du toast
  message: string;                               // Texte affiché à l'utilisateur
  exiting?: boolean;                             // true → déclenche l'animation de sortie
}

@Injectable({ providedIn: 'root' }) // Singleton : une seule instance partagée dans toute l'app
export class ToastService {

  // ─── État interne ─────────────────────────────────────────────────────────

  /** Compteur auto-incrémenté pour générer des IDs uniques */
  private counter = 0;

  /**
   * BehaviorSubject — Flux réactif qui contient la liste des toasts actifs.
   * BehaviorSubject (vs Subject) conserve la dernière valeur émise,
   * ce qui permet aux abonnés tardifs de la recevoir immédiatement.
   */
  private _toasts$ = new BehaviorSubject<Toast[]>([]);

  /**
   * Observable public exposé au ToastComponent.
   * Le composant s'y abonne via le pipe `| async` dans le template HTML.
   * On expose un Observable (et non le BehaviorSubject) pour
   * que seul ce service puisse émettre des valeurs (encapsulation).
   */
  toasts$ = this._toasts$.asObservable();

  // ─── Méthode interne d'ajout ───────────────────────────────────────────────

  /**
   * Ajoute un nouveau toast à la liste et programme sa suppression automatique.
   * @param type    → Type du toast (détermine la couleur du fond)
   * @param message → Texte à afficher à l'utilisateur
   */
  private add(type: Toast['type'], message: string) {
    const id = ++this.counter; // Génère un ID unique croissant

    // Crée un nouveau tableau en ajoutant le toast (immutabilité — bonne pratique RxJS)
    const toasts = [...this._toasts$.value, { id, type, message }];
    this._toasts$.next(toasts); // Émet le nouveau tableau → met à jour le ToastComponent

    // Auto-dismiss : supprime le toast après 3.5 secondes automatiquement
    setTimeout(() => this.dismiss(id), 3500);
  }

  // ─── API publique (méthodes utilisées dans les composants) ────────────────

  /** Affiche un toast VERT (opération réussie) */
  success(message: string) { this.add('success', message); }

  /** Affiche un toast ROUGE (erreur, problème réseau ou serveur) */
  error(message: string) { this.add('error', message); }

  /** Affiche un toast VIOLET (information neutre) */
  info(message: string) { this.add('info', message); }

  /** Affiche un toast ORANGE (avertissement, attention requise) */
  warning(message: string) { this.add('warning', message); }

  // ─── Suppression d'un toast ────────────────────────────────────────────────

  /**
   * Supprime un toast par son identifiant.
   * Phase 1 : marque le toast comme "exiting" → déclenche l'animation CSS de sortie
   * Phase 2 : après 300ms (durée de l'animation), le retire définitivement de la liste
   * @param id → Identifiant unique du toast à supprimer
   */
  dismiss(id: number) {
    // Étape 1 : Déclencher l'animation de sortie (slide + fade)
    const toasts = this._toasts$.value.map(t =>
      t.id === id ? { ...t, exiting: true } : t // Spread : copie l'objet en modifiant `exiting`
    );
    this._toasts$.next(toasts);

    // Étape 2 : Retirer le toast de la liste après la fin de l'animation (300ms)
    setTimeout(() => {
      this._toasts$.next(this._toasts$.value.filter(t => t.id !== id));
    }, 300);
  }
}
