/**
 * ============================================================
 * FICHIER  : data-quality-metric.model.ts
 * ENTITÉ   : DataQualityMetric (correspond à la classe
 *            "Data quality metrics" du diagramme de classes)
 *
 * RÔLE     : Interface TypeScript pour les métriques de qualité
 *            de données calculées par l'API .NET
 *            (DataQualityMetricsController).
 *
 * UNE MÉTRIQUE = Les statistiques de qualité pour UNE COLONNE
 *   d'un fichier CSV analysé. Une session peut avoir N métriques
 *   (une par colonne du fichier).
 * ============================================================
 */

/**
 * DataQualityMetric — Métriques de qualité pour une colonne.
 * Retourné par GET /api/DataQualityMetrics/by-session/{id}
 *
 * Champs calculés par le moteur ML.NET du backend :
 *  • qualityScore    → Score de qualité global (0 à 100)
 *  • missingValues   → Nombre de valeurs manquantes (null, vide)
 *  • duplicateValues → Nombre de doublons détectés
 *  • uniqueValues    → Nombre de valeurs distinctes
 *  • dataPatterns    → Patterns détectés (JSON : email, date, téléphone…)
 *  • qualityIssues   → Problèmes identifiés (JSON : texte libre)
 *  • basicStatistics → Statistiques de base (JSON : min, max, moyenne…)
 */
export interface DataQualityMetric {
  id: number;                          // Identifiant unique
  analysisSessionId: number;           // Session d'analyse parente
  columnName: string;                  // Nom de la colonne dans le CSV
  dataType: string;                    // Type détecté : "String", "Number", "Date"…
  position: number;                    // Position (index) de la colonne dans le CSV
  totalValues: number;                 // Nombre total de valeurs dans la colonne
  missingValues: number;               // Nombre de valeurs manquantes
  uniqueValues: number;                // Nombre de valeurs uniques
  duplicateValues: number;             // Nombre de doublons
  qualityScore: number;                // Score global de qualité (0-100)
  basicStatistics?: string | null;     // Stats JSON (min, max, moyenne, écart-type)
  dataPatterns?: string | null;        // Patterns JSON détectés automatiquement
  qualityIssues?: string | null;       // Problèmes JSON identifiés par le moteur
}
