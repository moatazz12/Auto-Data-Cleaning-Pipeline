using System;
using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace Metiers
{
    public class DataQualityMetric
    {
        [Key]
        public int Id { get; set; }

        // FK → AnalysisSession.Id
        [Required]
        public int AnalysisSessionId { get; set; }

        [Required, StringLength(150)]
        public string ColumnName { get; set; } = null!;

        [Required, StringLength(50)]
        public string DataType { get; set; } = null!;

        [Required]
        public int Position { get; set; }

        [Required]
        public int TotalValues { get; set; }

        [Required]
        public int MissingValues { get; set; }

        [Required]
        public int UniqueValues { get; set; }

        [Required]
        public int DuplicateValues { get; set; }

        [Required]
        [Precision(3, 3)]
        public decimal QualityScore { get; set; }

        public string? BasicStatistics { get; set; }
        public string? DataPatterns { get; set; }
        public string? QualityIssues { get; set; }
    }
}
