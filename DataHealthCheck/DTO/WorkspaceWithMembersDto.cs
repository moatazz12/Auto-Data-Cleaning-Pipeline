namespace DataHealthCheck.DTO
{
    public class WorkspaceWithMembersDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string Description { get; set; } = "";
        public string OwnerId { get; set; } = "";
        public string OwnerName { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        public string CurrentUserRole { get; set; } = ""; // "Owner", "Editor", "Viewer"

        public List<WorkspaceMemberDto> Members { get; set; } = new();
    }

    public class WorkspaceMemberDto
    {
        public int Id { get; set; }
        public string UserId { get; set; } = "";
        public string UserName { get; set; } = "";   // ou Email
        public string Role { get; set; } = "";
        public DateTime JoinedAt { get; set; }
    }
}
