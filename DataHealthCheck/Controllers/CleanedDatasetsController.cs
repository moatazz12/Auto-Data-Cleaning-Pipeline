using DataHealthCheck.DTO;
using DataHealthCheck.Repositories;
using DataHealthCheck.Services;
using Metiers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System;

namespace DataHealthCheck.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CleanedDatasetsController : ControllerBase
    {
        private readonly IDataCleaningService _cleaningService;
        private readonly IGenericRepository<AnalysisSession> _sessionRepo;
        private readonly IGenericRepository<CleanedDataset> _cleanedRepo;
        private readonly IGenericRepository<Workspace> _workspaceRepo;
        private readonly IGenericRepository<WorkspaceMember> _memberRepo;
        private readonly IWebHostEnvironment _env;

        public CleanedDatasetsController(
            IDataCleaningService cleaningService,
            IGenericRepository<AnalysisSession> sessionRepo,
            IGenericRepository<CleanedDataset> cleanedRepo,
            IGenericRepository<Workspace> workspaceRepo,
            IGenericRepository<WorkspaceMember> memberRepo,
            IWebHostEnvironment env)
        {
            _cleaningService = cleaningService;
            _sessionRepo = sessionRepo;
            _cleanedRepo = cleanedRepo;
            _workspaceRepo = workspaceRepo;
            _memberRepo = memberRepo;
            _env = env;
        }

        private string? GetCurrentUserId()
        {
            return User.FindFirstValue(ClaimTypes.NameIdentifier);
        }

        // Vérifie si l'utilisateur a accès au workspace (Owner, Editor ou Viewer)
        private async Task<bool> HasWorkspaceAccessAsync(string userId, int workspaceId)
        {
            var workspace = await _workspaceRepo.GetByIdAsync(workspaceId);
            if (workspace == null) return false;

            // Owner du workspace → toujours autorisé
            if (workspace.OwnerId == userId)
                return true;

            // Vérifier si membre avec rôle Editor ou Viewer
            var allMembers = await _memberRepo.GetAllAsync();
            var member = allMembers.FirstOrDefault(m =>
                m.WorkspaceId == workspaceId &&
                m.UserId == userId);

            if (member == null) return false;

            // Editor ou Viewer peuvent accéder
            return member.Role.Equals("Editor", StringComparison.OrdinalIgnoreCase) ||
                   member.Role.Equals("Viewer", StringComparison.OrdinalIgnoreCase);
        }

        // POST: api/CleanedDatasets/clean-session
        // Lance le cleaning à partir d'une AnalysisSession, écrit le fichier dans data_after_cleaning
        // puis stocke un enregistrement CleanedDataset en BD
        [HttpPost("clean-session")]
        public async Task<IActionResult> CleanForSession([FromBody] CleaningRequestDto request)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            // 1) Récupérer la session d'origine
            var session = await _sessionRepo.GetByIdAsync(request.AnalysisSessionId);
            if (session == null)
                return NotFound("Session introuvable.");

            if (!System.IO.File.Exists(session.FilePath))
                return BadRequest("Fichier brut introuvable sur le serveur.");

            // 2) Construire le chemin du fichier nettoyé
            var rootPath = _env.ContentRootPath;
            var cleanFolder = Path.Combine(rootPath, "data_after_cleaning");
            Directory.CreateDirectory(cleanFolder);

            // Nom de fichier nettoyé : cleaned_{sessionId}_{nomFichierOrigine}
            var outputName = $"cleaned_{session.Id}_{Path.GetFileName(session.FilePath)}";
            var outputPath = Path.Combine(cleanFolder, outputName);

            // 3) Appeler le service de cleaning (tout ton gros code)
            var result = _cleaningService.CleanDatasetGeneric(session.FilePath, outputPath);

            // 4) Construire la chaîne JSON des opérations (facultatif mais pratique)
            var operationsJson = System.Text.Json.JsonSerializer.Serialize(result.Operations);

            // 5) Créer l'entité CleanedDataset
            var cleaned = new CleanedDataset
            {
                OriginalSessionId = session.Id,
                Name = string.IsNullOrWhiteSpace(request.Name)
                    ? $"Cleaned - {session.SessionName}"
                    : request.Name,
                FilePath = outputPath,
                CleanedBy = userId,
                CleanedAt = DateTime.UtcNow,
                CleaningOperations = operationsJson,
                RowsCount = result.Report.CleanedRowCount,
                ColumnsCount = session.ColumnCount // même nombre de colonnes que le brut
            };

            var created = await _cleanedRepo.AddAsync(cleaned);

            // 6) Retourner les infos principales + quelques stats
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, new
            {
                created.Id,
                created.OriginalSessionId,
                created.Name,
                created.FilePath,
                created.CleanedBy,
                created.CleanedAt,
                created.RowsCount,
                created.ColumnsCount,
                Stats = new
                {
                    result.Report.OriginalRowCount,
                    result.Report.CleanedRowCount,
                    result.Report.TotalMissingImputed,
                    result.Report.TotalDuplicatesRemoved,
                    result.Report.TotalOutliersHandled,
                    result.Report.TotalFormatIssuesFixed
                }
            });
        }

        // GET: api/CleanedDatasets/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            var ds = await _cleanedRepo.GetByIdAsync(id);
            if (ds == null) return NotFound();

            // Récupérer la session pour obtenir le workspaceId
            var session = await _sessionRepo.GetByIdAsync(ds.OriginalSessionId);
            if (session == null) return NotFound();

            // Vérifier l'accès au workspace
            var hasAccess = await HasWorkspaceAccessAsync(userId, session.WorkspaceId);
            if (!hasAccess)
                return Forbid("Vous n'avez pas accès à ce workspace.");

            return Ok(ds);
        }

        // GET: api/CleanedDatasets/{id}/download
        // Télécharge le fichier nettoyé
        [HttpGet("{id}/download")]
        public async Task<IActionResult> DownloadFile(int id)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            var ds = await _cleanedRepo.GetByIdAsync(id);
            if (ds == null) return NotFound();

            // Récupérer la session pour obtenir le workspaceId
            var session = await _sessionRepo.GetByIdAsync(ds.OriginalSessionId);
            if (session == null) return NotFound();

            // Vérifier l'accès au workspace
            var hasAccess = await HasWorkspaceAccessAsync(userId, session.WorkspaceId);
            if (!hasAccess)
                return Forbid("Vous n'avez pas accès à ce workspace.");

            // Vérifier que le fichier existe
            if (!System.IO.File.Exists(ds.FilePath))
                return NotFound("Le fichier nettoyé n'existe plus sur le serveur.");

            // Lire le fichier et le retourner
            var fileBytes = await System.IO.File.ReadAllBytesAsync(ds.FilePath);
            var fileName = Path.GetFileName(ds.FilePath);

            // Si le nom commence par "cleaned_", on peut le nettoyer pour l'affichage
            var displayName = fileName.StartsWith("cleaned_")
                ? fileName.Substring(fileName.IndexOf('_', fileName.IndexOf('_') + 1) + 1)
                : fileName;

            return File(fileBytes, "text/csv", displayName);
        }

        // GET: api/CleanedDatasets/by-session/5
        [HttpGet("by-session/{sessionId}")]
        public async Task<IActionResult> GetBySession(int sessionId)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            // Récupérer la session pour obtenir le workspaceId
            var session = await _sessionRepo.GetByIdAsync(sessionId);
            if (session == null) return NotFound();

            // Vérifier l'accès au workspace
            var hasAccess = await HasWorkspaceAccessAsync(userId, session.WorkspaceId);
            if (!hasAccess)
                return Forbid("Vous n'avez pas accès à ce workspace.");

            var list = await _cleanedRepo
                .Query(c => c.OriginalSessionId == sessionId)
                .OrderByDescending(c => c.CleanedAt)
                .ToListAsync();
            return Ok(list);
        }

        // DELETE: api/CleanedDatasets/{id}
        // Supprime l'enregistrement + le fichier nettoyé
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            var ds = await _cleanedRepo.GetByIdAsync(id);
            if (ds == null) return NotFound();

            // Récupérer la session pour obtenir le workspaceId
            var session = await _sessionRepo.GetByIdAsync(ds.OriginalSessionId);
            if (session == null) return NotFound();

            // Vérifier que l'utilisateur est Owner ou Editor (pas Viewer)
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

                // Seuls Owner et Editor peuvent supprimer
                canDelete = member != null &&
                           (member.Role.Equals("Editor", StringComparison.OrdinalIgnoreCase) ||
                            member.Role.Equals("Owner", StringComparison.OrdinalIgnoreCase));
            }

            if (!canDelete)
                return Forbid("Seuls le propriétaire du workspace ou les éditeurs peuvent supprimer des rapports.");

            if (System.IO.File.Exists(ds.FilePath))
                System.IO.File.Delete(ds.FilePath);

            var ok = await _cleanedRepo.DeleteAsync(id);
            if (!ok) return BadRequest();

            return NoContent();
        }
    }
}
