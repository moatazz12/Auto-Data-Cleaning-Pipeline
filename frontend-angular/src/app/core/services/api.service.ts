/**
 * ============================================================
 * FICHIER  : api.service.ts
 * RÔLE     : Service HTTP central — point d'entrée unique pour
 *            toutes les requêtes vers l'API .NET backend.
 *
 * PRINCIPE : Tous les autres services (WorkspaceService,
 *            AuthService…) utilisent CE service au lieu
 *            d'HttpClient directement.
 *
 * AVANTAGES :
 *  1. URL de base configurée en un seul endroit
 *  2. Header "ngrok-skip-browser-warning" ajouté automatiquement
 *     (nécessaire pour le tunnel Ngrok en déploiement)
 *  3. Switching automatique dev/prod via isDevMode()
 *
 * URL EN DEV  : /api  → redirigé vers localhost:5111 par le proxy Angular
 * URL EN PROD : https://blank-uncheck-craving.ngrok-free.dev/api
 * ============================================================
 */
import { Injectable, isDevMode } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'  // Singleton injecté dans toute l'application
})
export class ApiService {

  /**
   * URL de base de l'API — choisie automatiquement selon l'environnement.
   *  • isDevMode() = true  → on utilise /api (proxy Angular → localhost:5111)
   *  • isDevMode() = false → on utilise l'URL Ngrok publique
   */
  private baseUrl = isDevMode()
    ? '/api'
    : 'https://blank-uncheck-craving.ngrok-free.dev/api';

  constructor(private http: HttpClient) { }

  /**
   * Ajoute le header de sécurité Ngrok aux en-têtes existants.
   * "ngrok-skip-browser-warning" → empêche Ngrok d'intercepter
   * les requêtes avec sa page d'avertissement.
   * Le token JWT est ajouté séparément par JwtInterceptor.
   */
  private addNgrokHeader(options: any): any {
    const headers = (options.headers || new HttpHeaders())
      .set('ngrok-skip-browser-warning', 'true');
    return { ...options, headers };
  }

  // ─── Méthodes HTTP génériques ─────────────────────────────────────────────

  /** GET — Récupère des données depuis l'API */
  get<T>(path: string, options: any = {}): Observable<T> {
    return this.http.get(`${this.baseUrl}${path}`, this.addNgrokHeader(options)) as Observable<T>;
  }

  /** POST — Crée une nouvelle ressource */
  post<T>(path: string, body: any = {}, options: any = {}): Observable<T> {
    return this.http.post(`${this.baseUrl}${path}`, body, this.addNgrokHeader(options)) as Observable<T>;
  }

  /** PUT — Met à jour une ressource existante */
  put<T>(path: string, body: any = {}, options: any = {}): Observable<T> {
    return this.http.put(`${this.baseUrl}${path}`, body, this.addNgrokHeader(options)) as Observable<T>;
  }

  /** DELETE — Supprime une ressource */
  delete<T>(path: string, options: any = {}): Observable<T> {
    return this.http.delete(`${this.baseUrl}${path}`, this.addNgrokHeader(options)) as Observable<T>;
  }
}
