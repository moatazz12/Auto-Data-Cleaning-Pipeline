using System;
using System.ComponentModel.DataAnnotations;

namespace Metiers
{
    public class CleanedDataset
    {
        [Key]
        public int Id { get; set; }

        // FK → AnalysisSession.Id
        [Required]
        public int OriginalSessionId { get; set; }

        [Required, StringLength(200)]
        public string Name { get; set; } = null!;

        [Required, StringLength(500)]
        public string FilePath { get; set; } = null!;

        // FK → ApplicationUser.Id
        [Required]
        public string CleanedBy { get; set; } = null!;

        [Required]
        public DateTime CleanedAt { get; set; }

        public string? CleaningOperations { get; set; }

        [Required]
        public int RowsCount { get; set; }

        [Required]
        public int ColumnsCount { get; set; }
    }
}
