using System;
using System.ComponentModel.DataAnnotations;

namespace Metiers
{
    public class AnalysisSession
    {
        [Key]
        public int Id { get; set; }

        [Required, StringLength(200)]
        public string SessionName { get; set; } = null!;

        [Required, StringLength(260)]
        public string OriginalFileName { get; set; } = null!;

        [Required, StringLength(500)]
        public string FilePath { get; set; } = null!;

        [Required]
        public int RowCount { get; set; }

        [Required]
        public int ColumnCount { get; set; }

        [Required]
        public DateTime UploadDate { get; set; }

        // FK → Workspace.Id
        [Required]
        public int WorkspaceId { get; set; }
    }
}
