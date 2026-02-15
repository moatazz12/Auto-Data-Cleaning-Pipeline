/**
 * ============================================================
 * FICHIER  : cleaned-dataset.service.ts
 * ENTITÉ   : CleanedDataset (correspond à la classe CleanedDataset
 *            du diagramme de classes UML)
 *
 * RÔLE     : Gère les opérations sur les datasets nettoyés.
 *  • Nettoyage  : lancer le processus de nettoyage d'une session
 *  • Lecture    : récupérer un dataset ou la liste par session
 *  • Suppression: supprimer un dataset nettoyé
 *  • Téléchargement : télécharger le fichier CSV nettoyé
 *
 * ROUTES API correspondantes (CleanedDatasetsController.cs) :
 *  POST   /api/CleanedDatasets/clean-session          → nettoyer une session
 *  GET    /api/CleanedDatasets/{id}                   → détail d'un dataset
 *  GET    /api/CleanedDatasets/by-session/{id}        → datasets d'une session
 *  DELETE /api/CleanedDatasets/{id}                   → supprimer un dataset
 *  GET    /api/CleanedDatasets/{id}/download          → télécharger le CSV
 * ============================================================
 */
import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';
import { CleanedDataset, CleaningRequestDto } from '../models/cleaned-dataset.model';

@Injectable({ providedIn: 'root' })
export class CleanedDatasetService {

  private readonly endpoint = '/CleanedDatasets';

  constructor(private api: ApiService) {}

  // ─── Nettoyage ────────────────────────────────────────────────────────────

  /**
   * Lance le nettoyage d'une session d'analyse.
   * Le backend applique les opérations de nettoyage et génère un nouveau CSV.
   * POST /api/CleanedDatasets/clean-session
   * @param request → { analysisSessionId, name }
   */
  cleanSession(request: CleaningRequestDto): Observable<CleanedDataset> {
    return this.api.post<CleanedDataset>(`${this.endpoint}/clean-session`, request);
  }

  // ─── Lecture ──────────────────────────────────────────────────────────────

  /**
   * Récupère un dataset nettoyé par son ID.
   * GET /api/CleanedDatasets/{id}
   * @param id → Identifiant du dataset nettoyé
   */
  getById(id: number): Observable<CleanedDataset> {
    return this.api.get<CleanedDataset>(`${this.endpoint}/${id}`);
  }

  /**
   * Récupère tous les datasets nettoyés d'une session d'analyse.
   * Une session peut avoir plusieurs datasets nettoyés (plusieurs tentatives).
   * GET /api/CleanedDatasets/by-session/{sessionId}
   * @param sessionId → Identifiant de la session source
   */
  getBySession(sessionId: number): Observable<CleanedDataset[]> {
    return this.api.get<CleanedDataset[]>(`${this.endpoint}/by-session/${sessionId}`);
  }

  // ─── Suppression ──────────────────────────────────────────────────────────

  /**
   * Supprime un dataset nettoyé.
   * DELETE /api/CleanedDatasets/{id}
   * @param id → Identifiant du dataset à supprimer
   */
  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${this.endpoint}/${id}`);
  }

  // ─── Téléchargement ───────────────────────────────────────────────────────

  /**
   * Télécharge le fichier CSV nettoyé.
   * responseType: 'blob' → reçoit le fichier binaire depuis le backend.
   * GET /api/CleanedDatasets/{id}/download
   * @param id → Identifiant du dataset à télécharger
   */
  downloadFile(id: number): Observable<Blob> {
    return this.api.get<Blob>(`${this.endpoint}/${id}/download`, { responseType: 'blob' });
  }
}
