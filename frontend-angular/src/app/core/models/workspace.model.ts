/**
 * ============================================================
 * FICHIER  : workspace.model.ts
 * ENTITÉ   : Workspace (correspond à la classe Workspace
 *            du diagramme de classes UML)
 *
 * RÔLE     : Définit les interfaces TypeScript pour les
 *            Workspaces et leurs membres, tels que renvoyés
 *            par l'API .NET (WorkspacesController).
 * ============================================================
 */

/**
 * Workspace — Structure complète d'un espace de travail.
 * Correspond à la table [Workspaces] en base de données.
 */
export interface Workspace {
  id: number;               // Identifiant unique (auto-incrémenté)
  name: string;             // Nom du workspace
  description?: string | null; // Description optionnelle
  ownerId: string;          // GUID de l'utilisateur propriétaire
  createdAt: Date;          // Date de création
}

/**
 * WorkspaceDto — Données envoyées lors de la CRÉATION / MODIFICATION.
 * (Data Transfer Object — ne contient que les champs modifiables)
 */
export interface WorkspaceDto {
  id: number;
  name: string;             // Nom (obligatoire)
  description?: string | null; // Description (optionnelle)
}

/**
 * WorkspaceMemberDto — Représentation d'un membre dans un workspace.
 * Utilisé dans les listes de membres affichées dans l'interface.
 */
export interface WorkspaceMemberDto {
  id: number;               // ID de la relation membre-workspace
  userId: string;           // GUID de l'utilisateur
  userName: string;         // Nom d'affichage du membre
  role: string;             // Rôle : "Owner", "Editor" ou "Viewer"
  joinedAt: Date;           // Date d'ajout dans le workspace
}

/**
 * WorkspaceWithMembersDto — Workspace complet avec sa liste de membres.
 * C'est l'objet principal retourné par GET /api/Workspaces.
 * Utilisé dans workspace-list et workspace-detail.
 */
export interface WorkspaceWithMembersDto {
  id: number;
  name: string;
  description: string;
  ownerId: string;          // GUID du propriétaire
  ownerName: string;        // Nom affiché du propriétaire
  createdAt: Date;
  currentUserRole: string;  // Rôle de l'utilisateur connecté dans CE workspace
  members: WorkspaceMemberDto[]; // Liste de tous les membres
}

/**
 * WorkspaceMemberInviteDto — Données pour inviter un nouveau membre.
 * Envoyé en POST /api/WorkspaceMembers/invite.
 */
export interface WorkspaceMemberInviteDto {
  workspaceId: number;      // ID du workspace ciblé
  userId: string;           // GUID de l'utilisateur à inviter
  role: string;             // Rôle attribué : "Editor" ou "Viewer"
}

/**
 * WorkspaceMember — Relation complète membre-workspace (côté BDD).
 * Utilisé en interne (identique à WorkspaceMemberDto mais avec workspaceId).
 */
export interface WorkspaceMember {
  id: number;
  workspaceId: number;
  userId: string;
  role: string;
  joinedAt: Date;
}
