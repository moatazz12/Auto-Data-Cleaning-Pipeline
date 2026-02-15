/**
 * ============================================================
 * FICHIER  : analysis-session.model.ts
 * ENTITÉ   : AnalysisSession (correspond à la classe AnalysisSession
 *            du diagramme de classes UML)
 *
 * RÔLE     : Interfaces TypeScript pour les sessions d'analyse,
 *            telles que retournées par l'API .NET
 *            (AnalysisSessionsController).
 *
 * UNE SESSION = Un fichier CSV importé dans un workspace.
 *               Contient les métadonnées du fichier (lignes, colonnes…)
 * ============================================================
 */

/**
 * AnalysisSession — Session d'analyse complète.
 * Retournée par GET /api/AnalysisSessions/{id}
 * et GET /api/AnalysisSessions/by-workspace/{workspaceId}
 */
export interface AnalysisSession {
  id: number;               // Identifiant unique
  sessionName: string;      // Nom donné par l'utilisateur
  originalFileName: string; // Nom du fichier CSV original
  filePath: string;         // Chemin de stockage sur le serveur
  rowCount: number;         // Nombre de lignes dans le CSV
  columnCount: number;      // Nombre de colonnes dans le CSV
  uploadDate: Date;         // Date d'importation du fichier
  workspaceId: number;      // Workspace parent
}

/**
 * AnalysisSessionCreateDto — Données pour créer une session.
 * Envoyé en POST /api/AnalysisSessions (avec fichier CSV en multipart/form-data)
 */
export interface AnalysisSessionCreateDto {
  sessionName: string;      // Nom de la session (saisi par l'utilisateur)
  workspaceId: number;      // Workspace de destination
}

/**
 * AnalyzeSessionRequestDto — Déclenchement de l'analyse de qualité.
 * Envoyé en POST /api/DataQualityMetrics/analyze-session
 * L'API calcule alors les métriques de qualité pour cette session.
 */
export interface AnalyzeSessionRequestDto {
  analysisSessionId: number; // Session à analyser
}
