namespace DataHealthCheck.DTO
{
    // Données envoyées en même temps que le fichier
    public class AnalysisSessionCreateDto
    {
        public string SessionName { get; set; } = string.Empty;
        public int WorkspaceId { get; set; }
    }
}
