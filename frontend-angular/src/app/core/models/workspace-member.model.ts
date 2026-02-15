/**
 * ============================================================
 * FICHIER  : workspace-member.model.ts
 * ENTITÉ   : WorkspaceMember (extrait du diagramme de classes)
 *
 * RÔLE     : Contient les interfaces TypeScript spécifiques
 *            aux membres des workspaces.
 *            Séparé de workspace.model.ts pour respecter
 *            le principe de responsabilité unique (SRP).
 * ============================================================
 */

/**
 * WorkspaceMember — Relation entre un Utilisateur et un Workspace.
 * Correspond à la table [WorkspaceMembers] en base de données.
 *
 * Champs :
 *  • id          → ID de la relation
 *  • workspaceId → Workspace concerné
 *  • userId      → GUID de l'utilisateur membre
 *  • role        → "Owner" | "Editor" | "Viewer"
 *  • joinedAt    → Date d'entrée dans le workspace
 */
export interface WorkspaceMember {
  id: number;
  workspaceId: number;
  userId: string;
  role: string;
  joinedAt: Date;
}

/**
 * WorkspaceMemberDto — Version étendue avec le nom d'utilisateur.
 * Retourné par l'API pour afficher le nom du membre dans l'interface.
 */
export interface WorkspaceMemberDto {
  id: number;
  workspaceId: number;
  userId: string;
  userName: string;   // Nom affiché dans la liste des membres
  role: string;
  joinedAt: Date;
}

/**
 * WorkspaceMemberInviteDto — Données pour inviter un nouveau membre.
 * Envoyé en POST /api/WorkspaceMembers/invite.
 */
export interface WorkspaceMemberInviteDto {
  workspaceId: number;  // Workspace ciblé
  userId: string;       // Utilisateur à inviter (GUID)
  role: string;         // Rôle accordé : "Editor" ou "Viewer"
}
