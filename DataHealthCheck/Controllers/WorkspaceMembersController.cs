using DataHealthCheck.Data;
using DataHealthCheck.DTO;
using DataHealthCheck.Repositories;
using Metiers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace DataHealthCheck.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class WorkspaceMembersController : ControllerBase
    {
        private readonly IGenericRepository<WorkspaceMember> _memberRepo;
        private readonly IGenericRepository<Workspace> _workspaceRepo;
        private readonly UserManager<ApplicationUser> _userManager;

        public WorkspaceMembersController(
            IGenericRepository<WorkspaceMember> memberRepo,
            IGenericRepository<Workspace> workspaceRepo,
            UserManager<ApplicationUser> userManager)
        {
            _memberRepo = memberRepo;
            _workspaceRepo = workspaceRepo;
            _userManager = userManager;
        }

        private string? GetCurrentUserId()
        {
            return User.FindFirstValue(ClaimTypes.NameIdentifier);
        }

        // GET: api/WorkspaceMembers/by-workspace/3
        [HttpGet("by-workspace/{workspaceId}")]
        public async Task<IActionResult> GetMembers(int workspaceId)
        {
            var all = await _memberRepo.GetAllAsync();
            var members = all.Where(m => m.WorkspaceId == workspaceId).ToList();

            // Récupérer les usernames pour chaque membre
            var result = new List<object>();
            foreach (var member in members)
            {
                var user = await _userManager.FindByIdAsync(member.UserId);
                result.Add(new
                {
                    member.Id,
                    member.WorkspaceId,
                    member.UserId,
                    UserName = user?.UserName ?? "",
                    member.Role,
                    member.JoinedAt
                });
            }

            return Ok(result);
        }

        // POST: api/WorkspaceMembers/invite
        // Owner invite directement un user avec un rôle (Editor/Viewer)
        [HttpPost("invite")]
        public async Task<IActionResult> Invite([FromBody] WorkspaceMemberInviteDto dto)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == null)
                return Unauthorized();

            // 1) Vérifier que le workspace existe
            var ws = await _workspaceRepo.GetByIdAsync(dto.WorkspaceId);
            if (ws == null)
                return NotFound("Workspace introuvable.");

            // 2) Vérifier que l'appelant est bien le owner du workspace
            if (ws.OwnerId != currentUserId)
                return Forbid("Seul le propriétaire peut inviter des membres.");

            // 3) Vérifier que l'utilisateur cible existe
            var targetUser = await _userManager.FindByIdAsync(dto.UserId);
            if (targetUser == null)
                return NotFound("Utilisateur cible introuvable.");

            // 4) Vérifier si déjà membre
            var allMembers = await _memberRepo.GetAllAsync();
            var already = allMembers
                .FirstOrDefault(m => m.WorkspaceId == dto.WorkspaceId && m.UserId == dto.UserId);

            if (already != null)
                return BadRequest("Cet utilisateur est déjà membre du workspace.");

            // 5) Créer l'entrée WorkspaceMember (invitation acceptée automatiquement)
            var member = new WorkspaceMember
            {
                WorkspaceId = dto.WorkspaceId,
                UserId = dto.UserId,
                Role = dto.Role,          // "Editor" ou "Viewer"
                JoinedAt = DateTime.UtcNow
            };

            var created = await _memberRepo.AddAsync(member);

            // Retourner avec le UserName
            return Ok(new
            {
                created.Id,
                created.WorkspaceId,
                created.UserId,
                UserName = targetUser.UserName ?? "",
                created.Role,
                created.JoinedAt
            });
        }

        // DELETE: api/WorkspaceMembers/{id}
        // Suppression par Id de membre (owner OU membre lui-même)
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == null)
                return Unauthorized();

            var member = await _memberRepo.GetByIdAsync(id);
            if (member == null)
                return NotFound();

            // Récupérer le workspace pour vérifier le owner
            var ws = await _workspaceRepo.GetByIdAsync(member.WorkspaceId);
            if (ws == null)
                return NotFound("Workspace introuvable.");

            // Règles :
            // - Owner peut supprimer n'importe quel membre
            // - Un membre peut se supprimer lui-même (quitter le workspace)
            var isOwner = ws.OwnerId == currentUserId;
            var isSelf = member.UserId == currentUserId;

            if (!isOwner && !isSelf)
                return Forbid("Vous ne pouvez pas supprimer ce membre.");

            var ok = await _memberRepo.DeleteAsync(id);
            if (!ok) return BadRequest();

            return NoContent();
        }
    }
}
