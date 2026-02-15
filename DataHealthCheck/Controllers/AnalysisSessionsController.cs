using DataHealthCheck.DTO;
using DataHealthCheck.Repositories;
using Metiers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System;

namespace DataHealthCheck.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AnalysisSessionsController : ControllerBase
    {
        private readonly IGenericRepository<AnalysisSession> _repo;
        private readonly IGenericRepository<Workspace> _workspaceRepo;
        private readonly IGenericRepository<WorkspaceMember> _memberRepo;
        private readonly IWebHostEnvironment _env;

        public AnalysisSessionsController(
            IGenericRepository<AnalysisSession> repo,
            IGenericRepository<Workspace> workspaceRepo,
            IGenericRepository<WorkspaceMember> memberRepo,
            IWebHostEnvironment env)
        {
            _repo = repo;
            _workspaceRepo = workspaceRepo;
            _memberRepo = memberRepo;
            _env = env;
        }

        private string? GetCurrentUserId()
        {
            return User.FindFirstValue(ClaimTypes.NameIdentifier);
        }

        // Check if user has access to the workspace (Owner, Editor or Viewer)
        private async Task<bool> HasWorkspaceAccessAsync(string userId, int workspaceId)
        {
            var workspace = await _workspaceRepo.GetByIdAsync(workspaceId);
            if (workspace == null) return false;

            if (workspace.OwnerId == userId)
                return true;

            var allMembers = await _memberRepo.GetAllAsync();
            var member = allMembers.FirstOrDefault(m =>
                m.WorkspaceId == workspaceId &&
                m.UserId == userId);

            if (member == null) return false;

            return member.Role.Equals("Editor", StringComparison.OrdinalIgnoreCase) ||
                   member.Role.Equals("Viewer", StringComparison.OrdinalIgnoreCase);
        }

        // POST: api/AnalysisSessions
        [HttpPost]
        [RequestSizeLimit(100_000_000)]
        public async Task<IActionResult> Create(
            [FromForm] AnalysisSessionCreateDto dto,
            IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file sent.");

            var rootPath = _env.ContentRootPath;
            var folder = Path.Combine(rootPath, "data_before_cleaning");
            Directory.CreateDirectory(folder);

            var uniqueName = $"{Guid.NewGuid()}_{file.FileName}";
            var filePath = Path.Combine(folder, uniqueName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            int rowCount = 0;
            int columnCount = 0;

            using (var reader = new StreamReader(filePath))
            {
                string? line;
                while ((line = await reader.ReadLineAsync()) != null)
                {
                    rowCount++;
                    if (rowCount == 1)
                    {
                        columnCount = line.Split(',', ';', '\t').Length;
                    }
                }
            }

            var session = new AnalysisSession
            {
                SessionName = dto.SessionName,
                OriginalFileName = file.FileName,
                FilePath = filePath,
                RowCount = rowCount,
                ColumnCount = columnCount,
                UploadDate = DateTime.UtcNow,
                WorkspaceId = dto.WorkspaceId
            };

            var created = await _repo.AddAsync(session);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }

        // GET: api/AnalysisSessions/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            var session = await _repo.GetByIdAsync(id);
            if (session == null) return NotFound();

            var hasAccess = await HasWorkspaceAccessAsync(userId, session.WorkspaceId);
            if (!hasAccess)
                return Forbid("Access denied to this workspace.");

            return Ok(session);
        }

        // GET: api/AnalysisSessions/by-workspace/{workspaceId}
        [HttpGet("by-workspace/{workspaceId}")]
        public async Task<IActionResult> GetByWorkspace(int workspaceId)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            var hasAccess = await HasWorkspaceAccessAsync(userId, workspaceId);
            if (!hasAccess)
                return Forbid("Access denied to this workspace.");

            var all = await _repo.GetAllAsync();
            var list = all.Where(s => s.WorkspaceId == workspaceId).ToList();
            return Ok(list);
        }

        // PUT: api/AnalysisSessions/{id}
        // Rename a session (Update its SessionName)
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] AnalysisSessionUpdateDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            var session = await _repo.GetByIdAsync(id);
            if (session == null) return NotFound();

            var workspace = await _workspaceRepo.GetByIdAsync(session.WorkspaceId);
            if (workspace == null) return NotFound();

            bool canEdit = false;
            if (workspace.OwnerId == userId)
            {
                canEdit = true;
            }
            else
            {
                var allMembers = await _memberRepo.GetAllAsync();
                var member = allMembers.FirstOrDefault(m =>
                    m.WorkspaceId == session.WorkspaceId &&
                    m.UserId == userId);

                canEdit = member != null &&
                          member.Role.Equals("Editor", StringComparison.OrdinalIgnoreCase);
            }

            if (!canEdit)
                return Forbid("Only workspace owners and editors can rename sessions.");

            if (string.IsNullOrWhiteSpace(dto.SessionName))
                return BadRequest("Session name cannot be empty.");

            session.SessionName = dto.SessionName.Trim();
            await _repo.UpdateAsync(session);

            return Ok(session);
        }

        // DELETE: api/AnalysisSessions/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            var session = await _repo.GetByIdAsync(id);
            if (session == null) return NotFound();

            var workspace = await _workspaceRepo.GetByIdAsync(session.WorkspaceId);
            if (workspace == null) return NotFound();

            bool canDelete = false;
            if (workspace.OwnerId == userId)
            {
                canDelete = true;
            }
            else
            {
                var allMembers = await _memberRepo.GetAllAsync();
                var member = allMembers.FirstOrDefault(m =>
                    m.WorkspaceId == session.WorkspaceId &&
                    m.UserId == userId);

                canDelete = member != null &&
                           (member.Role.Equals("Editor", StringComparison.OrdinalIgnoreCase) ||
                            member.Role.Equals("Owner", StringComparison.OrdinalIgnoreCase));
            }

            if (!canDelete)
                return Forbid("Only workspace owners and editors can delete sessions.");

            if (System.IO.File.Exists(session.FilePath))
            {
                System.IO.File.Delete(session.FilePath);
            }

            var ok = await _repo.DeleteAsync(id);
            if (!ok) return BadRequest();

            return NoContent();
        }
    }
}
