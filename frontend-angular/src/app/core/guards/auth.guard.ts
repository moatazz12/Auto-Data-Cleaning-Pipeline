/**
 * ============================================================
 * FICHIER  : auth.guard.ts
 * RÔLE     : Gardes de routes Angular (CanActivateFn)
 *
 * DEUX GARDES :
 *  • authGuard  → protège les pages PRIVÉES (dashboard, workspaces…)
 *                 Redirige vers /login si l'utilisateur n'est PAS connecté.
 *  • guestGuard → protège les pages PUBLIQUES (login, register)
 *                 Redirige vers /dashboard si l'utilisateur EST déjà connecté.
 *
 * COMMENT ÇA FONCTIONNE :
 *  Angular vérifie ces gardes AVANT d'activer la route.
 *  Si la garde retourne false → la navigation est annulée.
 *  Si la garde retourne true  → la navigation continue normalement.
 * ============================================================
 */
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * authGuard — Garde pour les routes PROTÉGÉES.
 *
 * Utilisé sur : dashboard, workspaces, workspace-detail, cleaning-report
 * Logique : si le token JWT est absent → redirection vers /login
 */
export const authGuard: CanActivateFn = (route, state) => {
  // Injection des dépendances (nouvelle syntaxe Angular 15+)
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    // Token absent ou invalide → l'utilisateur n'est pas authentifié
    router.navigate(['/login']);
    return false; // Bloque l'accès à la route
  }

  return true; // Accès autorisé
};

/**
 * guestGuard — Garde pour les routes PUBLIQUES.
 *
 * Utilisé sur : /login, /register
 * Logique : si le token JWT est présent → redirection vers /dashboard
 * (évite qu'un utilisateur déjà connecté revienne sur la page de login)
 */
export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    // Déjà connecté → inutile d'afficher login/register
    router.navigate(['/dashboard']);
    return false; // Bloque l'accès à /login et /register
  }

  return true; // Accès autorisé (l'utilisateur n'est pas connecté)
};
