using System;
using System.ComponentModel.DataAnnotations;

namespace Metiers
{
    public class Workspace
    {
        [Key]
        public int Id { get; set; }

        [Required, StringLength(150)]
        public string Name { get; set; } = null!;

        [StringLength(500)]
        public string? Description { get; set; }

        // FK → ApplicationUser.Id
        [Required]
        public string OwnerId { get; set; } = null!;

        [Required]
        public DateTime CreatedAt { get; set; }
    }
}
