/**
 * ============================================================
 * FICHIER  : commentaire.model.ts
 * ENTITÉ   : Commentaire (correspond à la classe Commentaire
 *            du diagramme de classes UML)
 *
 * RÔLE     : Interfaces TypeScript pour les commentaires
 *            associés à une session d'analyse,
 *            retournés par l'API .NET (CommentairesController).
 *
 * UN COMMENTAIRE = Une note textuelle ajoutée par un utilisateur
 *   sur une session d'analyse. Permet la collaboration et
 *   la documentation au sein d'un workspace partagé.
 * ============================================================
 */

/**
 * Commentaire — Commentaire complet tel que stocké en base.
 * Retourné par GET /api/Commentaires/by-session/{analysisSessionId}
 */
export interface Commentaire {
  id: number;                      // Identifiant unique
  analysisSessionId: number;       // Session d'analyse concernée
  userId: string;                  // GUID de l'auteur du commentaire
  contenu: string;                 // Texte du commentaire
  dateCreation: Date;              // Date de création
  dateModification?: Date | null;  // Date de dernière modification (optionnel)
}

/**
 * CommentaireDto — Données pour créer ou modifier un commentaire.
 * Envoyé en POST /api/Commentaires (création)
 *     et PUT  /api/Commentaires/{id} (modification)
 */
export interface CommentaireDto {
  id: number;                  // 0 pour la création, ID existant pour la modification
  analysisSessionId: number;   // Session parente
  contenu: string;             // Texte du commentaire (obligatoire)
}
