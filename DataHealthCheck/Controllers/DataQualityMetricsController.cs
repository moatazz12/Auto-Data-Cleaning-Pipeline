using DataHealthCheck.DTO;
using DataHealthCheck.Repositories;
using DataHealthCheck.Services;
using Metiers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;

namespace DataHealthCheck.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DataQualityMetricsController : ControllerBase
    {
        private readonly IGenericRepository<DataQualityMetric> _repo;
        private readonly IDataQualityMetricsService _service;
        private readonly IGenericRepository<AnalysisSession> _sessionRepo;

        public DataQualityMetricsController(
            IGenericRepository<DataQualityMetric> repo,
            IDataQualityMetricsService service,
            IGenericRepository<AnalysisSession> sessionRepo)
        {
            _repo = repo;
            _service = service;
            _sessionRepo = sessionRepo;
        }

        // GET: api/DataQualityMetrics
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var metrics = await _repo.GetAllAsync();
            return Ok(metrics);
        }

        // GET: api/DataQualityMetrics/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var metric = await _repo.GetByIdAsync(id);
            if (metric == null) return NotFound();
            return Ok(metric);
        }

        [HttpGet("by-session/{analysisSessionId}")]
        public async Task<IActionResult> GetBySession(int analysisSessionId)
        {
            var all = await _repo.GetAllAsync();
            var list = all
                .Where(m => m.AnalysisSessionId == analysisSessionId)
                .ToList();

            if (!list.Any())
                return NotFound("Aucune métrique pour cette session.");

            return Ok(list);
        }

        // NOUVEAU : POST analyse à partir d'une session déjà créée
        // POST: api/DataQualityMetrics/analyze-session
        [HttpPost("analyze-session")]
        public async Task<IActionResult> AnalyzeForSession([FromBody] AnalyzeSessionRequestDto request)
        {
            try
            {
                // 1) Récupérer la session
                var session = await _sessionRepo.GetByIdAsync(request.AnalysisSessionId);
                if (session == null)
                    return NotFound("Session introuvable.");

                if (!System.IO.File.Exists(session.FilePath))
                    return BadRequest("Fichier source introuvable sur le serveur.");

                // 2) Appeler le service avec FilePath + session.Id
                var metrics = await _service.AnalyzeDatasetAsync(session.FilePath, session.Id);

                // 3) Sauvegarder en BD
                foreach (var m in metrics)
                {
                    try
                    {
                        await _repo.AddAsync(m);
                    }
                    catch (InvalidOperationException ex)
                    {
                        return StatusCode(500, new { message = "Erreur lors de la sauvegarde en base de données.", error = ex.Message });
                    }
                }

                return Ok(new
                {
                    message = "Analyse terminée et résultats enregistrés.",
                    analysisSessionId = session.Id,
                    metricsCount = metrics.Count
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Une erreur est survenue lors de l'analyse.", error = ex.Message });
            }
        }

        // PUT: api/DataQualityMetrics/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] DataQualityMetric metric)
        {
            if (id != metric.Id) return BadRequest();
            var success = await _repo.UpdateAsync(metric);
            if (!success) return NotFound();
            return NoContent();
        }

        // NOUVEAU : POST analyse à partir d'un cleaned dataset
        // POST: api/DataQualityMetrics/analyze-cleaned-dataset
        [HttpPost("analyze-cleaned-dataset")]
        public async Task<IActionResult> AnalyzeForCleanedDataset([FromBody] AnalyzeCleanedDatasetRequestDto request)
        {
            // 1) Récupérer le cleaned dataset
            var cleanedRepo = HttpContext.RequestServices.GetRequiredService<IGenericRepository<CleanedDataset>>();
            var cleaned = await cleanedRepo.GetByIdAsync(request.CleanedDatasetId);
            if (cleaned == null)
                return NotFound("Cleaned dataset introuvable.");

            if (!System.IO.File.Exists(cleaned.FilePath))
                return BadRequest("Fichier nettoyé introuvable sur le serveur.");

            // 2) Récupérer la session originale pour obtenir l'ID de session
            var session = await _sessionRepo.GetByIdAsync(cleaned.OriginalSessionId);
            if (session == null)
                return NotFound("Session originale introuvable.");

            // 3) Créer une session "virtuelle" pour les métriques du cleaned dataset
            // On utilise un AnalysisSessionId négatif ou on crée un système de mapping
            // Pour simplifier, on va utiliser l'ID du cleaned dataset avec un offset
            // Mais il faut d'abord vérifier si on a déjà des métriques pour ce cleaned dataset
            
            // 4) Appeler le service avec FilePath du cleaned dataset
            // On utilise l'ID du cleaned dataset avec un offset pour différencier
            // Pour l'instant, on va utiliser cleaned.Id * -1 comme AnalysisSessionId temporaire
            // Mais il faudrait mieux avoir un champ IsCleanedDataset dans DataQualityMetric
            // Pour simplifier, on va utiliser cleaned.Id avec un offset de 1000000
            var virtualSessionId = 1000000 + cleaned.Id;
            var metrics = await _service.AnalyzeDatasetAsync(cleaned.FilePath, virtualSessionId);

            // 5) Sauvegarder en BD avec un marqueur spécial
            // On va stocker l'ID du cleaned dataset dans AnalysisSessionId avec un offset
            foreach (var m in metrics)
            {
                // Stocker l'ID du cleaned dataset dans AnalysisSessionId avec offset
                m.AnalysisSessionId = virtualSessionId;
                // Effacer BasicStatistics pour les métriques après nettoyage
                m.BasicStatistics = null;
                await _repo.AddAsync(m);
            }

            return Ok(new
            {
                message = "Analyse du dataset nettoyé terminée et résultats enregistrés.",
                cleanedDatasetId = cleaned.Id,
                metricsCount = metrics.Count
            });
        }

        // GET: api/DataQualityMetrics/by-cleaned-dataset/{cleanedDatasetId}
        [HttpGet("by-cleaned-dataset/{cleanedDatasetId}")]
        public async Task<IActionResult> GetByCleanedDataset(int cleanedDatasetId)
        {
            var all = await _repo.GetAllAsync();
            // Les métriques du cleaned dataset ont un AnalysisSessionId = 1000000 + cleanedDatasetId
            var virtualSessionId = 1000000 + cleanedDatasetId;
            var list = all
                .Where(m => m.AnalysisSessionId == virtualSessionId)
                .ToList();

            if (!list.Any())
                return NotFound("Aucune métrique pour ce dataset nettoyé.");

            return Ok(list);
        }

        // DELETE: api/DataQualityMetrics/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var success = await _repo.DeleteAsync(id);
            if (!success) return NotFound();
            return NoContent();
        }
    }
}
