/**
 * ============================================================
 * FICHIER  : workspace-members.service.ts
 * ENTITÉ   : WorkspaceMembers (correspond à la classe
 *            workspacemembers du diagramme de classes)
 *
 * RÔLE     : Gère les opérations sur les membres des workspaces.
 *  • Lecture    : liste des membres d'un workspace
 *  • Invitation : ajouter un utilisateur comme membre
 *  • Suppression: retirer un membre du workspace
 *
 * ROUTES API correspondantes (WorkspaceMembersController.cs) :
 *  GET    /api/WorkspaceMembers/by-workspace/{id} → membres du workspace
 *  POST   /api/WorkspaceMembers/invite            → inviter un membre
 *  DELETE /api/WorkspaceMembers/{id}              → retirer un membre
 * ============================================================
 */
import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';
import { WorkspaceMemberDto, WorkspaceMemberInviteDto } from '../models/workspace-member.model';

// Re-export pour compatibilité : les composants qui importent
// WorkspaceMemberDto depuis ce service continueront de fonctionner
export { WorkspaceMemberDto, WorkspaceMemberInviteDto } from '../models/workspace-member.model';

@Injectable({ providedIn: 'root' })
export class WorkspaceMembersService {

  private base = '/WorkspaceMembers';

  constructor(private api: ApiService) { }

  // ─── Lecture ──────────────────────────────────────────────────────────────

  /**
   * Récupère la liste de tous les membres d'un workspace.
   * GET /api/WorkspaceMembers/by-workspace/{workspaceId}
   * @param workspaceId → Identifiant du workspace
   */
  getByWorkspace(workspaceId: number): Observable<WorkspaceMemberDto[]> {
    return this.api.get<WorkspaceMemberDto[]>(`${this.base}/by-workspace/${workspaceId}`);
  }

  // ─── Invitation ───────────────────────────────────────────────────────────

  /**
   * Invite un utilisateur dans un workspace avec un rôle spécifique.
   * Seul le PROPRIÉTAIRE (Owner) peut inviter des membres.
   * POST /api/WorkspaceMembers/invite
   * @param dto → { workspaceId, userId, role }
   *              role = "Editor" ou "Viewer"
   */
  inviteMember(dto: WorkspaceMemberInviteDto): Observable<WorkspaceMemberDto> {
    return this.api.post<WorkspaceMemberDto>(`${this.base}/invite`, dto);
  }

  // ─── Suppression ──────────────────────────────────────────────────────────

  /**
   * Retire un membre du workspace.
   * L'Owner peut retirer n'importe quel membre.
   * Un membre peut se retirer lui-même.
   * DELETE /api/WorkspaceMembers/{id}
   * @param id → Identifiant de la RELATION membre-workspace (pas du userId)
   */
  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${id}`);
  }
}
