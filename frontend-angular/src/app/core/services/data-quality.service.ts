/**
 * ============================================================
 * FICHIER  : data-quality.service.ts
 * ENTITÉ   : DataQualityMetrics (correspond à la classe
 *            "Data quality metrics" du diagramme de classes)
 *
 * RÔLE     : Gère les opérations sur les métriques de qualité.
 *  • Analyse  : déclencher l'analyse d'une session ou d'un dataset
 *  • Lecture  : récupérer les métriques par session ou dataset
 *  • Mise à jour : modifier une métrique (correction manuelle)
 *  • Suppression : supprimer une métrique
 *
 * ROUTES API correspondantes (DataQualityMetricsController.cs) :
 *  GET    /api/DataQualityMetrics/{id}                          → une métrique
 *  GET    /api/DataQualityMetrics/by-session/{id}              → métriques d'une session
 *  GET    /api/DataQualityMetrics/by-cleaned-dataset/{id}      → métriques d'un dataset nettoyé
 *  POST   /api/DataQualityMetrics/analyze-session              → analyser une session
 *  POST   /api/DataQualityMetrics/analyze-cleaned-dataset      → analyser un dataset nettoyé
 *  PUT    /api/DataQualityMetrics/{id}                         → modifier une métrique
 *  DELETE /api/DataQualityMetrics/{id}                         → supprimer une métrique
 * ============================================================
 */
import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';
import { DataQualityMetric } from '../models/data-quality-metric.model';
import { AnalyzeSessionRequestDto } from '../models/analysis-session.model';
import { AnalyzeCleanedDatasetRequestDto } from '../models/cleaned-dataset.model';

@Injectable({ providedIn: 'root' })
export class DataQualityService {

  constructor(private api: ApiService) {}

  // ─── Lecture ──────────────────────────────────────────────────────────────

  /**
   * Récupère toutes les métriques de qualité (toutes sessions confondues).
   * GET /api/DataQualityMetrics
   */
  getAll(): Observable<DataQualityMetric[]> {
    return this.api.get<DataQualityMetric[]>('/DataQualityMetrics');
  }

  /**
   * Récupère une métrique de qualité spécifique par son ID.
   * GET /api/DataQualityMetrics/{id}
   */
  getById(id: number): Observable<DataQualityMetric> {
    return this.api.get<DataQualityMetric>(`/DataQualityMetrics/${id}`);
  }

  /**
   * Récupère toutes les métriques d'une session d'analyse.
   * UNE MÉTRIQUE PAR COLONNE → le tableau a autant d'éléments que de colonnes.
   * GET /api/DataQualityMetrics/by-session/{analysisSessionId}
   * @param analysisSessionId → Session d'analyse parente
   */
  getBySession(analysisSessionId: number): Observable<DataQualityMetric[]> {
    return this.api.get<DataQualityMetric[]>(`/DataQualityMetrics/by-session/${analysisSessionId}`);
  }

  /**
   * Récupère toutes les métriques d'un dataset nettoyé.
   * Permet de comparer la qualité avant/après nettoyage.
   * GET /api/DataQualityMetrics/by-cleaned-dataset/{cleanedDatasetId}
   */
  getByCleanedDataset(cleanedDatasetId: number): Observable<DataQualityMetric[]> {
    return this.api.get<DataQualityMetric[]>(`/DataQualityMetrics/by-cleaned-dataset/${cleanedDatasetId}`);
  }

  // ─── Analyse ──────────────────────────────────────────────────────────────

  /**
   * Déclenche l'analyse de qualité d'une session d'analyse.
   * Le backend (ML.NET) calcule les métriques pour chaque colonne du CSV.
   * POST /api/DataQualityMetrics/analyze-session
   * @param dto → { analysisSessionId }
   */
  analyzeSession(dto: AnalyzeSessionRequestDto): Observable<any> {
    return this.api.post('/DataQualityMetrics/analyze-session', dto);
  }

  /**
   * Déclenche l'analyse de qualité d'un dataset nettoyé.
   * Permet d'obtenir les métriques APRÈS nettoyage pour comparer.
   * POST /api/DataQualityMetrics/analyze-cleaned-dataset
   * @param dto → { cleanedDatasetId }
   */
  analyzeCleanedDataset(dto: AnalyzeCleanedDatasetRequestDto): Observable<any> {
    return this.api.post('/DataQualityMetrics/analyze-cleaned-dataset', dto);
  }

  // ─── Mise à jour ──────────────────────────────────────────────────────────

  /**
   * Modifie manuellement une métrique de qualité.
   * PUT /api/DataQualityMetrics/{id}
   * @param id     → Identifiant de la métrique
   * @param metric → Nouvelles valeurs de la métrique
   */
  update(id: number, metric: DataQualityMetric): Observable<any> {
    return this.api.put(`/DataQualityMetrics/${id}`, metric);
  }

  // ─── Suppression ──────────────────────────────────────────────────────────

  /**
   * Supprime une métrique de qualité.
   * DELETE /api/DataQualityMetrics/{id}
   * @param id → Identifiant de la métrique à supprimer
   */
  delete(id: number): Observable<any> {
    return this.api.delete(`/DataQualityMetrics/${id}`);
  }
}
