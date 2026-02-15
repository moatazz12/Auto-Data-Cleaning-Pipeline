/**
 * ============================================================
 * FICHIER  : commentaire.service.ts
 * ENTITÉ   : Commentaire (correspond à la classe Commentaire
 *            du diagramme de classes UML)
 *
 * RÔLE     : Gère les opérations CRUD sur les commentaires
 *            associés aux sessions d'analyse.
 *
 * ROUTES API correspondantes (CommentairesController.cs) :
 *  GET    /api/Commentaires/by-session/{id} → commentaires d'une session
 *  POST   /api/Commentaires                 → créer un commentaire
 *  PUT    /api/Commentaires/{id}            → modifier un commentaire
 *  DELETE /api/Commentaires/{id}            → supprimer un commentaire
 * ============================================================
 */
import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';
import { Commentaire, CommentaireDto } from '../models/commentaire.model';

@Injectable({ providedIn: 'root' })
export class CommentaireService {

  constructor(private api: ApiService) {}

  // ─── Lecture ──────────────────────────────────────────────────────────────

  /**
   * Récupère tous les commentaires d'une session d'analyse.
   * GET /api/Commentaires/by-session/{analysisSessionId}
   * @param analysisSessionId → Session d'analyse concernée
   */
  getBySession(analysisSessionId: number): Observable<Commentaire[]> {
    return this.api.get<Commentaire[]>(`/Commentaires/by-session/${analysisSessionId}`);
  }

  // ─── Création ─────────────────────────────────────────────────────────────

  /**
   * Crée un nouveau commentaire sur une session d'analyse.
   * POST /api/Commentaires
   * @param dto → { id: 0, analysisSessionId, contenu }
   */
  create(dto: CommentaireDto): Observable<any> {
    return this.api.post('/Commentaires', dto);
  }

  // ─── Mise à jour ──────────────────────────────────────────────────────────

  /**
   * Modifie un commentaire existant.
   * Seul l'auteur peut modifier son propre commentaire.
   * PUT /api/Commentaires/{id}
   * @param id  → Identifiant du commentaire
   * @param dto → Nouvelles valeurs { id, analysisSessionId, contenu }
   */
  update(id: number, dto: CommentaireDto): Observable<any> {
    return this.api.put(`/Commentaires/${id}`, dto);
  }

  // ─── Suppression ──────────────────────────────────────────────────────────

  /**
   * Supprime un commentaire.
   * DELETE /api/Commentaires/{id}
   * @param id → Identifiant du commentaire à supprimer
   */
  delete(id: number): Observable<any> {
    return this.api.delete(`/Commentaires/${id}`);
  }
}
