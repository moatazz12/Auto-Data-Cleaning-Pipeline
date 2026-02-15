using DataHealthCheck.Data;
using DataHealthCheck.DTO;
using DataHealthCheck.Repositories;
using Metiers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DataHealthCheck.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class WorkspacesController : ControllerBase
    {
        private readonly IGenericRepository<Workspace> _repo;
        private readonly IGenericRepository<WorkspaceMember> _memberRepo;
        private readonly UserManager<ApplicationUser> _userManager;

        public WorkspacesController(
            IGenericRepository<Workspace> repo,
            IGenericRepository<WorkspaceMember> memberRepo,
            UserManager<ApplicationUser> userManager)
        {
            _repo = repo;
            _memberRepo = memberRepo;
            _userManager = userManager;
        }

        private string? GetCurrentUserId()
        {
            return User.FindFirstValue(ClaimTypes.NameIdentifier);
        }

        private string GetCurrentUserDisplayName()
        {
            return User.FindFirstValue(ClaimTypes.Name) ?? string.Empty;
        }

        // GET: api/Workspaces
        [HttpGet]
        public async Task<IActionResult> GetMyWorkspaces()
        {
            var ownerId = GetCurrentUserId();
            if (ownerId == null)
                return Unauthorized();

            var ownerName = GetCurrentUserDisplayName();

            var all = await _repo.GetAllAsync();
            var mine = all.Where(w => w.OwnerId == ownerId).ToList();

            // Charger tous les membres liés à ces workspaces
            var allMembers = await _memberRepo.GetAllAsync();
            var membersByWorkspace = allMembers
                .Where(m => mine.Select(w => w.Id).Contains(m.WorkspaceId))
                .GroupBy(m => m.WorkspaceId)
                .ToDictionary(g => g.Key, g => g.ToList());

            var result = new List<WorkspaceWithMembersDto>();

            foreach (var ws in mine)
            {
                var dto = new WorkspaceWithMembersDto
                {
                    Id = ws.Id,
                    Name = ws.Name,
                    Description = ws.Description ?? string.Empty,
                    OwnerId = ws.OwnerId,
                    OwnerName = ownerName,
                    CreatedAt = ws.CreatedAt,
                    Members = new List<WorkspaceMemberDto>(),
                    CurrentUserRole = "Owner"
                };

                if (membersByWorkspace.TryGetValue(ws.Id, out var members))
                {
                    foreach (var m in members)
                    {
                        var user = await _userManager.FindByIdAsync(m.UserId);
                        dto.Members.Add(new WorkspaceMemberDto
                        {
                            Id = m.Id,
                            UserId = m.UserId,
                            UserName = user?.UserName ?? "",
                            Role = m.Role,
                            JoinedAt = m.JoinedAt
                        });
                    }
                }

                result.Add(dto);
            }

            return Ok(result);
        }

        // GET: api/Workspaces/shared
        [HttpGet("shared")]
        public async Task<IActionResult> GetSharedWithMe()
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            var members = await _memberRepo.GetAllAsync();
            var workspaceIds = members
                .Where(m => m.UserId == userId)
                .Select(m => new { m.WorkspaceId, m.Role })
                .ToList();

            if (!workspaceIds.Any())
                return Ok(new List<WorkspaceWithMembersDto>());

            var all = await _repo.GetAllAsync();
            var shared = all.Where(w => workspaceIds.Select(x => x.WorkspaceId).Contains(w.Id)).ToList();

            var ownerIds = shared.Select(w => w.OwnerId).Distinct().ToList();
            var owners = await _userManager.Users
                .Where(u => ownerIds.Contains(u.Id))
                .Select(u => new { u.Id, u.UserName })
                .ToListAsync();
            var ownerLookup = owners.ToDictionary(o => o.Id, o => o.UserName ?? "Owner");

            var allMembers = await _memberRepo.GetAllAsync();
            var membersByWorkspace = allMembers
                .Where(m => shared.Select(s => s.Id).Contains(m.WorkspaceId))
                .GroupBy(m => m.WorkspaceId)
                .ToDictionary(g => g.Key, g => g.ToList());

            var result = new List<WorkspaceWithMembersDto>();

            foreach (var ws in shared)
            {
                var dto = new WorkspaceWithMembersDto
                {
                    Id = ws.Id,
                    Name = ws.Name,
                    OwnerId = ws.OwnerId,
                    OwnerName = ownerLookup.TryGetValue(ws.OwnerId, out var name) ? name : "Owner",
                    CreatedAt = ws.CreatedAt,
                    Members = new List<WorkspaceMemberDto>(),
                    CurrentUserRole = workspaceIds.First(x => x.WorkspaceId == ws.Id).Role
                };

                if (membersByWorkspace.TryGetValue(ws.Id, out var membersList))
                {
                    foreach (var m in membersList)
                    {
                        var user = await _userManager.FindByIdAsync(m.UserId);
                        dto.Members.Add(new WorkspaceMemberDto
                        {
                            Id = m.Id,
                            UserId = m.UserId,
                            UserName = user?.UserName ?? "",
                            Role = m.Role,
                            JoinedAt = m.JoinedAt
                        });
                    }
                }

                result.Add(dto);
            }

            return Ok(result);
        }

        // GET: api/Workspaces/5
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            var ws = await _repo.GetByIdAsync(id);
            if (ws == null)
                return NotFound();

            // Vérifier si l'utilisateur est Owner ou membre (Editor/Viewer)
            bool hasAccess = false;
            string currentUserRole = "";

            var allMembers = await _memberRepo.GetAllAsync();

            if (ws.OwnerId == userId)
            {
                hasAccess = true;
                currentUserRole = "Owner";
            }
            else
            {
                var member = allMembers.FirstOrDefault(m => m.WorkspaceId == id && m.UserId == userId);
                if (member != null)
                {
                    hasAccess = true;
                    currentUserRole = member.Role;
                }
            }

            if (!hasAccess)
                return Forbid("Vous n'avez pas accès à ce workspace.");

            // Récupérer le nom du propriétaire
            var owner = await _userManager.FindByIdAsync(ws.OwnerId);
            var ownerName = owner?.UserName ?? "Owner";

            var members = allMembers.Where(m => m.WorkspaceId == id).ToList();

            var dto = new WorkspaceWithMembersDto
            {
                Id = ws.Id,
                Name = ws.Name,
                Description = ws.Description ?? string.Empty,
                OwnerId = ws.OwnerId,
                OwnerName = ownerName,
                CreatedAt = ws.CreatedAt,
                CurrentUserRole = currentUserRole,
                Members = new List<WorkspaceMemberDto>()
            };

            foreach (var m in members)
            {
                var user = await _userManager.FindByIdAsync(m.UserId);
                dto.Members.Add(new WorkspaceMemberDto
                {
                    Id = m.Id,
                    UserId = m.UserId,
                    UserName = user?.UserName ?? "",
                    Role = m.Role,
                    JoinedAt = m.JoinedAt
                });
            }

            return Ok(dto);
        }

        // POST, PUT, DELETE restent comme avant
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] WorkspaceDto dto)
        {
            var ownerId = GetCurrentUserId();
            if (ownerId == null)
                return Unauthorized();

            var workspace = new Workspace
            {
                Name = dto.Name,
                Description = dto.Description,
                OwnerId = ownerId,
                CreatedAt = DateTime.UtcNow
            };

            var created = await _repo.AddAsync(workspace);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] WorkspaceDto dto)
        {
            var ownerId = GetCurrentUserId();
            if (ownerId == null)
                return Unauthorized();

            if (id != dto.Id)
                return BadRequest();

            var existing = await _repo.GetByIdAsync(id);
            if (existing == null || existing.OwnerId != ownerId)
                return NotFound();

            existing.Name = dto.Name;
            existing.Description = dto.Description;

            var ok = await _repo.UpdateAsync(existing);
            if (!ok) return BadRequest();

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var ownerId = GetCurrentUserId();
            if (ownerId == null)
                return Unauthorized();

            var existing = await _repo.GetByIdAsync(id);
            if (existing == null || existing.OwnerId != ownerId)
                return NotFound();

            var ok = await _repo.DeleteAsync(id);
            if (!ok) return BadRequest();

            return NoContent();
        }
    }
}
