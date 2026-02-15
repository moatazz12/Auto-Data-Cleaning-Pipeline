/**
 * ============================================================
 * FICHIER  : layout.component.ts
 * COMPOSANT: LayoutComponent
 * ROUTE    : Shell principal — enveloppe toutes les pages protégées
 *
 * RÔLE     : Composant "Shell" de l'application.
 *            Gère la barre de navigation latérale (sidebar),
 *            la barre supérieure (topbar), et le contenu principal
 *            via <router-outlet>.
 *
 * FONCTIONNALITÉS :
 *  • Affichage du nom de l'utilisateur connecté (displayName)
 *  • Ouverture / Fermeture de la sidebar (toggle)
 *  • Fermeture automatique de la sidebar sur mobile après navigation
 *  • Gestion responsive via HostListener (window:resize)
 *  • Déconnexion (logout → /login)
 *
 * PATTERN Angular :
 *  • @HostListener : Écoute les événements natifs du navigateur
 *    directement dans le composant, sans passer par un service.
 *    Ici utilisé pour détecter le redimensionnement de la fenêtre.
 * ============================================================
 */
import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * LayoutComponent — Shell principal de l'application.
 * Ce composant est chargé pour toutes les routes protégées
 * (dashboard, workspaces, etc.) via le module de routage imbriqué.
 */
@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent implements OnInit {

  // ─── État de la sidebar ────────────────────────────────────────────────────
  /** true = sidebar visible, false = sidebar masquée (fermée) */
  isSidebarOpen: boolean = true;

  // ─── Données utilisateur ───────────────────────────────────────────────────
  /** Nom affiché dans la topbar (récupéré depuis localStorage au login) */
  userDisplayName: string = '';

  /**
   * Constructeur — Injection des dépendances.
   * @param authService Service d'authentification (logout)
   * @param router      Service Angular de navigation (Router)
   */
  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    // Récupère le nom d'affichage stocké lors de la connexion
    this.userDisplayName = localStorage.getItem('displayName') || 'User';
  }

  /**
   * ngOnInit — Initialisation du composant.
   * Vérifie la taille de l'écran pour adapter l'état initial de la sidebar.
   */
  ngOnInit() {
    this.checkScreenSize();
  }

  // ─── Responsive — Gestion du redimensionnement ────────────────────────────

  /**
   * @HostListener — Écoute l'événement natif "resize" de la fenêtre.
   * Appelé automatiquement par Angular à chaque fois que l'utilisateur
   * redimensionne la fenêtre du navigateur.
   */
  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  /**
   * Adapte l'état de la sidebar en fonction de la largeur d'écran.
   * • >= 992px (Desktop/Tablette large) → sidebar ouverte
   * • <  992px (Mobile/Tablette)        → sidebar fermée
   */
  private checkScreenSize() {
    // Seuil de 992px pour le passage tablette/desktop
    this.isSidebarOpen = window.innerWidth >= 992;
  }

  // ─── Navigation Sidebar ───────────────────────────────────────────────────

  /**
   * Toggle manuel de la sidebar (bouton hamburger ☰ dans la topbar).
   * Inverse l'état actuel : ouverte → fermée, et vice-versa.
   */
  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  /**
   * Ferme automatiquement la sidebar sur mobile après un clic sur un lien de navigation.
   * Sur desktop (>= 992px), la sidebar reste ouverte.
   */
  closeSidebarOnMobile(): void {
    if (window.innerWidth < 992) {
      this.isSidebarOpen = false;
    }
  }

  // ─── Authentification ─────────────────────────────────────────────────────

  /**
   * Déconnecte l'utilisateur.
   * Appelle AuthService.logout() pour vider le localStorage
   * puis redirige vers la page de connexion.
   */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
