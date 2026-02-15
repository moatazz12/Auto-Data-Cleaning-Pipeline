using Metiers;

namespace DataHealthCheck.Services
{
    public interface IDataQualityMetricsService
    {
        // Analyse un fichier et renvoie les métriques à stocker
        Task<List<DataQualityMetric>> AnalyzeDatasetAsync(string filePath, int analysisSessionId);
    }
}
