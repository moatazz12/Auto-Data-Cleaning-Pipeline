namespace DataHealthCheck.DTO
{
    public class WorkspaceDto
    {
        public int Id { get; set; }          // utile pour le PUT
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
    }
}
