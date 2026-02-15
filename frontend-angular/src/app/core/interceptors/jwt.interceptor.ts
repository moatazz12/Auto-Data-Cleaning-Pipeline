/**
 * ============================================================
 * FICHIER  : jwt.interceptor.ts
 * RÔLE     : Intercepteur HTTP — injecte automatiquement
 *            le token JWT dans chaque requête sortante.
 *
 * PRINCIPE : Angular appelle `intercept()` avant chaque
 *            appel HTTP. On récupère le token stocké dans
 *            localStorage et on l'ajoute dans l'en-tête
 *            "Authorization: Bearer <token>".
 *
 * Ce mécanisme évite de répéter `headers` dans chaque service.
 * ============================================================
 */
import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {

  /**
   * Méthode principale de l'intercepteur.
   * @param request  La requête HTTP originale
   * @param next     Le gestionnaire qui envoie la requête
   * @returns        L'Observable de l'événement HTTP
   */
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {

    // 1. Lire le token JWT depuis le localStorage (stocké lors du login)
    const token = localStorage.getItem('token');

    // 2. Si un token existe, cloner la requête et ajouter l'en-tête Authorization
    if (token) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`   // Format standard OAuth2 / JWT
        }
      });
    }

    // 3. Passer la requête (modifiée ou non) au prochain handler
    return next.handle(request);
  }
}
