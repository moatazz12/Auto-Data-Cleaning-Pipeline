/**
 * ============================================================
 * FICHIER  : workspace.service.ts
 * ENTITÉ   : Workspace (correspond à la classe Workspace
 *            du diagramme de classes UML)
 *
 * RÔLE     : Gère toutes les opérations CRUD sur les workspaces.
 *  • Lecture  : liste des workspaces possédés et partagés
 *  • Création : nouveau workspace
 *  • Mise à jour : nom et description
 *  • Suppression : workspace complet
 *
 * ROUTES API correspondantes (WorkspacesController.cs) :
 *  GET    /api/Workspaces             → workspaces possédés
 *  GET    /api/Workspaces/shared      → workspaces partagés
 *  GET    /api/Workspaces/{id}        → détail d'un workspace
 *  POST   /api/Workspaces             → créer un workspace
 *  PUT    /api/Workspaces/{id}        → modifier un workspace
 *  DELETE /api/Workspaces/{id}        → supprimer un workspace
 * ============================================================
 */
import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';
import { WorkspaceDto, WorkspaceWithMembersDto } from '../models/workspace.model';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {

  constructor(private api: ApiService) {}

  // ─── Lecture ──────────────────────────────────────────────────────────────

  /**
   * Récupère les workspaces dont l'utilisateur connecté est le PROPRIÉTAIRE.
   * GET /api/Workspaces
   */
  getWorkspaces(): Observable<WorkspaceWithMembersDto[]> {
    return this.api.get<WorkspaceWithMembersDto[]>('/Workspaces');
  }

  /**
   * Récupère les workspaces PARTAGÉS avec l'utilisateur connecté.
   * (Workspaces où il est Editor ou Viewer, mais pas Owner)
   * GET /api/Workspaces/shared
   */
  getSharedWorkspaces(): Observable<WorkspaceWithMembersDto[]> {
    return this.api.get<WorkspaceWithMembersDto[]>('/Workspaces/shared');
  }

  /**
   * Récupère les détails d'un workspace spécifique avec ses membres.
   * GET /api/Workspaces/{id}
   * @param id → Identifiant du workspace
   */
  getWorkspaceById(id: number): Observable<WorkspaceWithMembersDto> {
    return this.api.get<WorkspaceWithMembersDto>(`/Workspaces/${id}`);
  }

  // ─── Création ─────────────────────────────────────────────────────────────

  /**
   * Crée un nouveau workspace.
   * POST /api/Workspaces
   * @param data → { name, description }
   */
  createWorkspace(data: WorkspaceDto): Observable<any> {
    return this.api.post('/Workspaces', data);
  }

  // ─── Mise à jour ──────────────────────────────────────────────────────────

  /**
   * Modifie le nom et la description d'un workspace existant.
   * Seul le PROPRIÉTAIRE (Owner) peut modifier.
   * PUT /api/Workspaces/{id}
   * @param id   → Identifiant du workspace à modifier
   * @param data → Nouvelles valeurs { name, description }
   */
  updateWorkspace(id: number, data: WorkspaceDto): Observable<any> {
    return this.api.put(`/Workspaces/${id}`, data);
  }

  // ─── Suppression ──────────────────────────────────────────────────────────

  /**
   * Supprime définitivement un workspace et tout son contenu.
   * Seul le PROPRIÉTAIRE (Owner) peut supprimer.
   * DELETE /api/Workspaces/{id}
   * @param id → Identifiant du workspace à supprimer
   */
  deleteWorkspace(id: number): Observable<any> {
    return this.api.delete(`/Workspaces/${id}`);
  }
}
