/**
 * ============================================================
 * FICHIER  : auth.service.ts
 * ENTITÉ   : Utilisateur (gestion de l'authentification)
 *
 * RÔLE     : Gère toutes les opérations liées à l'authentification :
 *  • Inscription (register)
 *  • Connexion (login) + stockage du token JWT
 *  • Récupération de la liste des utilisateurs
 *  • Vérification de l'état de connexion (isLoggedIn)
 *  • Déconnexion (logout)
 *
 * STOCKAGE JWT : Après le login, le token est stocké dans
 *   localStorage['token'] et automatiquement injecté dans
 *   chaque requête HTTP par JwtInterceptor.
 * ============================================================
 */
import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable, tap } from 'rxjs';
import { LoginDto } from '../models/login-dto.model';
import { RegisterDto } from '../models/register-dto.model';
import { User } from '../models/utilisateur.model';

@Injectable({ providedIn: 'root' })
export class AuthService {

  constructor(private api: ApiService) {}

  // ─── Inscription ──────────────────────────────────────────────────────────

  /**
   * Inscrit un nouvel utilisateur.
   * Appel : POST /api/Account/register
   * @param dto → { firstName, lastName, email, userName, password }
   * @returns   Observable<string> — message de confirmation du backend
   */
  register(dto: RegisterDto): Observable<any> {
    // responseType: 'text' car l'API retourne une chaîne (pas du JSON)
    return this.api.post('/Account/register', dto, { responseType: 'text' });
  }

  // ─── Connexion ────────────────────────────────────────────────────────────

  /**
   * Connecte un utilisateur et stocke son token JWT + infos dans localStorage.
   * Appel : POST /api/Account/login
   * @param dto → { userName, password }
   * @returns   Observable<{ token, userName, firstName, lastName }>
   *
   * PATTERN RxJS : On utilise `pipe(tap(...))` pour effectuer un effet
   * de bord (stockage) sans modifier la valeur de l'Observable.
   */
  login(dto: LoginDto): Observable<any> {
    return this.api.post('/Account/login', dto).pipe(
      tap((res: any) => {
        if (res && res.token) {
          // Stocker le token JWT pour les prochaines requêtes (via JwtInterceptor)
          localStorage.setItem('token', res.token);

          // Stocker le userName pour la gestion des rôles dans les workspaces
          const currentUserName = res.userName || res.username || '';
          localStorage.setItem('userName', currentUserName);

          // Stocker le nom d'affichage (prénom + nom) pour l'interface
          const displayName = (res.firstName || res.lastName)
            ? `${res.firstName} ${res.lastName}`.trim()
            : currentUserName;
          localStorage.setItem('displayName', displayName);
        }
      })
    );
  }

  // ─── Utilisateurs ─────────────────────────────────────────────────────────

  /**
   * Récupère la liste de tous les utilisateurs enregistrés.
   * Utilisé pour inviter des membres dans un workspace.
   * Appel : GET /api/Account/users
   * @returns Observable<User[]>
   */
  getUsers(): Observable<User[]> {
    return this.api.get<User[]>('/Account/users');
  }

  // ─── Vérification de l'état de connexion ─────────────────────────────────

  /**
   * Vérifie si l'utilisateur est actuellement connecté.
   * Utilisé par authGuard et guestGuard pour protéger les routes.
   * @returns true si un token valide est présent dans localStorage
   */
  isLoggedIn(): boolean {
    const token = localStorage.getItem('token');
    // Vérifie que le token est présent ET n'est pas une valeur invalide
    return !!token && token !== 'null' && token !== 'undefined' && token.trim() !== '';
  }

  // ─── Déconnexion ──────────────────────────────────────────────────────────

  /**
   * Déconnecte l'utilisateur en supprimant toutes ses données du localStorage.
   * Après logout, l'utilisateur est redirigé vers /login (par le composant appelant).
   */
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('displayName');
    localStorage.removeItem('userName');
  }
}
