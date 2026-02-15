/**
 * ============================================================
 * FICHIER  : analysis-session.service.ts
 * ENTITÉ   : AnalysisSession (correspond à la classe Analysis Session
 *            du diagramme de classes UML)
 *
 * RÔLE     : Gère toutes les opérations CRUD sur les sessions
 *            d'analyse (fichiers CSV importés dans un workspace).
 *
 * ROUTES API correspondantes (AnalysisSessionsController.cs) :
 *  GET    /api/AnalysisSessions/{id}                  → détail d'une session
 *  GET    /api/AnalysisSessions/by-workspace/{id}     → sessions d'un workspace
 *  POST   /api/AnalysisSessions                       → importer un fichier CSV
 *  PUT    /api/AnalysisSessions/{id}                  → renommer une session
 *  DELETE /api/AnalysisSessions/{id}                  → supprimer une session
 *
 * PARTICULARITÉ : La création utilise multipart/form-data
 *   (envoi simultané des métadonnées + fichier CSV).
 * ============================================================
 */
import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

/**
 * AnalysisSession — Session d'analyse complète (définie ici pour
 * usage interne du service, modèle complet dans analysis-session.model.ts)
 */
export interface AnalysisSession {
  id: number;
  sessionName: string;
  originalFileName: string;
  filePath?: string;
  rowCount: number;
  columnCount: number;
  uploadDate: string;
  workspaceId: number;
}

export interface AnalysisSessionCreateDto {
  sessionName: string;
  workspaceId: number;
}

export interface AnalysisSessionUpdateDto {
  sessionName: string;
}

@Injectable({ providedIn: 'root' })
export class AnalysisSessionService {

  private base = '/AnalysisSessions';

  constructor(private api: ApiService) {}

  // ─── Lecture ──────────────────────────────────────────────────────────────

  /**
   * Récupère les détails d'une session d'analyse par son ID.
   * GET /api/AnalysisSessions/{id}
   * @param id → Identifiant de la session
   */
  getById(id: number): Observable<AnalysisSession> {
    return this.api.get<AnalysisSession>(`${this.base}/${id}`);
  }

  /**
   * Récupère toutes les sessions d'analyse d'un workspace.
   * GET /api/AnalysisSessions/by-workspace/{workspaceId}
   * @param workspaceId → Identifiant du workspace parent
   */
  getByWorkspace(workspaceId: number): Observable<AnalysisSession[]> {
    return this.api.get<AnalysisSession[]>(`${this.base}/by-workspace/${workspaceId}`);
  }

  // ─── Création ─────────────────────────────────────────────────────────────

  /**
   * Crée une nouvelle session d'analyse en important un fichier CSV.
   * POST /api/AnalysisSessions (multipart/form-data)
   *
   * MULTIPART : On utilise FormData pour envoyer à la fois :
   *  • Les métadonnées (sessionName, workspaceId) en texte
   *  • Le fichier CSV en binaire
   * HttpClient détecte automatiquement le Content-Type.
   *
   * @param dto  → { sessionName, workspaceId }
   * @param file → Fichier CSV sélectionné par l'utilisateur
   */
  create(dto: AnalysisSessionCreateDto, file: File): Observable<AnalysisSession> {
    const formData = new FormData();
    formData.append('sessionName', dto.sessionName);
    formData.append('workspaceId', dto.workspaceId.toString());
    formData.append('file', file, file.name); // file.name = nom du fichier CSV
    return this.api.post<AnalysisSession>(this.base, formData);
  }

  // ─── Mise à jour ──────────────────────────────────────────────────────────

  /**
   * Renomme une session d'analyse.
   * PUT /api/AnalysisSessions/{id}
   * @param id  → Identifiant de la session
   * @param dto → { sessionName } — nouveau nom
   */
  update(id: number, dto: AnalysisSessionUpdateDto): Observable<AnalysisSession> {
    return this.api.put<AnalysisSession>(`${this.base}/${id}`, dto);
  }

  // ─── Suppression ──────────────────────────────────────────────────────────

  /**
   * Supprime une session d'analyse et son fichier CSV associé.
   * DELETE /api/AnalysisSessions/{id}
   * @param id → Identifiant de la session à supprimer
   */
  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${id}`);
  }
}
