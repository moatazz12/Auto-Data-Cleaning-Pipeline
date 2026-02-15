namespace DataHealthCheck.DTO
{
    public class WorkspaceMemberInviteDto
    {
        public int WorkspaceId { get; set; }
        public string UserId { get; set; } = string.Empty;   // ou Email si tu préfères plus tard
        public string Role { get; set; } = string.Empty;     // "Editor" ou "Viewer"
    }
}
