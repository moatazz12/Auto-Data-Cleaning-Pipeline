using System.ComponentModel.DataAnnotations;

namespace DataHealthCheck.DTO
{
    public class CleaningRequestDto
    {
        [Required(ErrorMessage = "AnalysisSessionId est obligatoire.")]
        [Range(1, int.MaxValue, ErrorMessage = "AnalysisSessionId doit être un nombre positif.")]
        public int AnalysisSessionId { get; set; }
        
        public string Name { get; set; } = string.Empty; // nom logique du dataset nettoyé (optionnel)
    }
}



