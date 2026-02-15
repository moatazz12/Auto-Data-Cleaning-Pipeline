using System.ComponentModel.DataAnnotations;

namespace DataHealthCheck.DTO
{
    public class AnalyzeSessionRequestDto
    {
        [Required(ErrorMessage = "AnalysisSessionId est obligatoire.")]
        [Range(1, int.MaxValue, ErrorMessage = "AnalysisSessionId doit être un nombre positif.")]
        public int AnalysisSessionId { get; set; }
    }
}
