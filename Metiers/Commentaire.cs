using System;
using System.ComponentModel.DataAnnotations;

namespace Metiers
{
    public class Commentaire
    {
        [Key]
        public int Id { get; set; }

        // FK → AnalysisSession.Id
        [Required]
        public int AnalysisSessionId { get; set; }

        // FK → ApplicationUser.Id
        [Required]
        public string UserId { get; set; } = null!;

        [Required]
        public string Contenu { get; set; } = null!;

        [Required]
        public DateTime DateCreation { get; set; }

        public DateTime? DateModification { get; set; }
    }
}
