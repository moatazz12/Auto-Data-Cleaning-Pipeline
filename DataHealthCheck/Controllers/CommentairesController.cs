using DataHealthCheck.DTO;
using DataHealthCheck.Repositories;
using Metiers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace DataHealthCheck.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CommentairesController : ControllerBase
    {
        private readonly IGenericRepository<Commentaire> _commentRepo;
        private readonly IGenericRepository<AnalysisSession> _sessionRepo;
        private readonly IGenericRepository<Workspace> _workspaceRepo;
        private readonly IGenericRepository<WorkspaceMember> _memberRepo;

        public CommentairesController(
            IGenericRepository<Commentaire> commentRepo,
            IGenericRepository<AnalysisSession> sessionRepo,
            IGenericRepository<Workspace> workspaceRepo,
            IGenericRepository<WorkspaceMember> memberRepo)
        {
            _commentRepo = commentRepo;
            _sessionRepo = sessionRepo;
            _workspaceRepo = workspaceRepo;
            _memberRepo = memberRepo;
        }

        private string? GetCurrentUserId()
        {
            return User.FindFirstValue(ClaimTypes.NameIdentifier);
        }

        // Vérifie si l'utilisateur a le droit de commenter (Owner ou Editor du workspace)
        private async Task<bool> CanCommentAsync(string userId, int analysisSessionId)
        {
            // 1) récupérer la session
            var session = await _sessionRepo.GetByIdAsync(analysisSessionId);
            if (session == null) return false;

            // 2) récupérer le workspace
            var workspace = await _workspaceRepo.GetByIdAsync(session.WorkspaceId);
            if (workspace == null) return false;

            // Owner du workspace → toujours autorisé
            if (workspace.OwnerId == userId)
                return true;

            // 3) vérifier si membre avec rôle Editor
            var allMembers = await _memberRepo.GetAllAsync();
            var member = allMembers.FirstOrDefault(m =>
                m.WorkspaceId == session.WorkspaceId &&
                m.UserId == userId);

            if (member == null) return false;

            // Seul Editor (ou éventuel Owner dans la table) peut commenter, pas Viewer
            return member.Role.Equals("Editor", StringComparison.OrdinalIgnoreCase);
        }

        // GET: api/Commentaires/by-session/5
        [HttpGet("by-session/{analysisSessionId}")]
        public async Task<IActionResult> GetBySession(int analysisSessionId)
        {
            var all = await _commentRepo.GetAllAsync();
            var list = all.Where(c => c.AnalysisSessionId == analysisSessionId)
                          .OrderBy(c => c.DateCreation)
                          .ToList();

            return Ok(list);
        }

        // POST: api/Commentaires
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CommentaireDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            // Autorisation : Owner ou Editor du workspace de la session
            var allowed = await CanCommentAsync(userId, dto.AnalysisSessionId);
            if (!allowed)
                return Forbid("Seuls le propriétaire du workspace ou les éditeurs peuvent commenter.");

            var comment = new Commentaire
            {
                AnalysisSessionId = dto.AnalysisSessionId,
                UserId = userId,
                Contenu = dto.Contenu,
                DateCreation = DateTime.UtcNow,
                DateModification = null
            };

            var created = await _commentRepo.AddAsync(comment);
            return CreatedAtAction(nameof(GetBySession),
                new { analysisSessionId = created.AnalysisSessionId }, created);
        }

        // PUT: api/Commentaires/5
        // L'auteur du commentaire (ou Owner du workspace) peut modifier
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] CommentaireDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            if (id != dto.Id)
                return BadRequest();

            var existing = await _commentRepo.GetByIdAsync(id);
            if (existing == null)
                return NotFound();

            // Autorisation :
            // - auteur du commentaire
            // - OU owner du workspace de la session
            var session = await _sessionRepo.GetByIdAsync(existing.AnalysisSessionId);
            if (session == null) return NotFound("Session introuvable.");
            var workspace = await _workspaceRepo.GetByIdAsync(session.WorkspaceId);
            if (workspace == null) return NotFound("Workspace introuvable.");

            var isOwner = workspace.OwnerId == userId;
            var isAuthor = existing.UserId == userId;

            if (!isOwner && !isAuthor)
                return Forbid("Vous ne pouvez pas modifier ce commentaire.");

            existing.Contenu = dto.Contenu;
            existing.DateModification = DateTime.UtcNow;

            var ok = await _commentRepo.UpdateAsync(existing);
            if (!ok) return BadRequest();

            return NoContent();
        }

        // DELETE: api/Commentaires/5
        // Auteur ou Owner peuvent supprimer
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            var existing = await _commentRepo.GetByIdAsync(id);
            if (existing == null)
                return NotFound();

            var session = await _sessionRepo.GetByIdAsync(existing.AnalysisSessionId);
            if (session == null) return NotFound("Session introuvable.");
            var workspace = await _workspaceRepo.GetByIdAsync(session.WorkspaceId);
            if (workspace == null) return NotFound("Workspace introuvable.");

            var isOwner = workspace.OwnerId == userId;
            var isAuthor = existing.UserId == userId;

            if (!isOwner && !isAuthor)
                return Forbid("Vous ne pouvez pas supprimer ce commentaire.");

            var ok = await _commentRepo.DeleteAsync(id);
            if (!ok) return BadRequest();

            return NoContent();
        }
    }
}
