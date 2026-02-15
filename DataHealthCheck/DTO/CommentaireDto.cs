namespace DataHealthCheck.DTO
{
    public class CommentaireDto
    {
        public int Id { get; set; }                 // utile pour PUT
        public int AnalysisSessionId { get; set; }  // sur quelle session
        public string Contenu { get; set; } = string.Empty;
    }
}
