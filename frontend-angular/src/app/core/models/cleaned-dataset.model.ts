/**
 * ============================================================
 * FICHIER  : cleaned-dataset.model.ts
 * ENTITÉ   : CleanedDataset (correspond à la classe CleanedDataset
 *            du diagramme de classes UML)
 *
 * RÔLE     : Interfaces TypeScript pour les datasets nettoyés,
 *            retournés par l'API .NET (CleanedDatasetsController).
 *
 * UN CLEANED DATASET = Le résultat d'un nettoyage d'une session.
 *   L'utilisateur choisit les opérations de nettoyage →
 *   L'API génère un nouveau fichier CSV nettoyé.
 * ============================================================
 */

/**
 * CleanedDataset — Dataset nettoyé complet.
 * Retourné par GET /api/CleanedDatasets/{id}
 * et GET /api/CleanedDatasets/by-session/{sessionId}
 */
export interface CleanedDataset {
  id: number;                         // Identifiant unique
  originalSessionId: number;          // Session source (avant nettoyage)
  name: string;                       // Nom donné au dataset nettoyé
  filePath: string;                   // Chemin du fichier CSV nettoyé
  cleanedBy: string;                  // Nom de l'utilisateur qui a nettoyé
  cleanedAt: string | Date;           // Date du nettoyage
  rowsCount: number;                  // Nombre de lignes après nettoyage
  columnsCount: number;               // Nombre de colonnes après nettoyage
  cleaningOperations?: string | null; // Opérations appliquées (JSON sérialisé)
  stats?: CleaningStats;              // Statistiques du nettoyage (optionnel)
}

/**
 * CleaningStats — Statistiques de nettoyage.
 * Résumé chiffré des modifications apportées lors du nettoyage.
 */
export interface CleaningStats {
  originalRowCount: number;       // Nombre de lignes AVANT nettoyage
  cleanedRowCount: number;        // Nombre de lignes APRÈS nettoyage
  totalMissingImputed: number;    // Valeurs manquantes imputées
  totalDuplicatesRemoved: number; // Doublons supprimés
  totalOutliersHandled: number;   // Valeurs aberrantes traitées
  totalFormatIssuesFixed: number; // Problèmes de format corrigés
}

/**
 * AnalyzeCleanedDatasetRequestDto — Déclenchement de l'analyse du dataset nettoyé.
 * Envoyé en POST /api/DataQualityMetrics/analyze-cleaned-dataset
 */
export interface AnalyzeCleanedDatasetRequestDto {
  cleanedDatasetId: number; // Dataset nettoyé à analyser
}

/**
 * CleaningRequestDto — Données pour lancer un nettoyage.
 * Envoyé en POST /api/CleanedDatasets/clean-session
 */
export interface CleaningRequestDto {
  analysisSessionId: number; // Session source à nettoyer
  name: string;              // Nom à donner au dataset nettoyé
}
