using System;
using System.ComponentModel.DataAnnotations;

namespace Metiers
{
    public class WorkspaceMember
    {
        [Key]
        public int Id { get; set; }

        // FK → Workspace.Id
        [Required]
        public int WorkspaceId { get; set; }

        // FK → ApplicationUser.Id
        [Required]
        public string UserId { get; set; } = null!;

        [Required, StringLength(50)]
        public string Role { get; set; } = null!;

        [Required]
        public DateTime JoinedAt { get; set; }
    }
}
