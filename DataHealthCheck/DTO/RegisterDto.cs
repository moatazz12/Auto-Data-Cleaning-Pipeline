namespace DataHealthCheck.DTO
{
    public class RegisterDto
    {
        public string UserName { get; set; } = string.Empty;   // pour le login par username
        public string Email { get; set; } = string.Empty;      // email stocké dans AspNetUsers
        public string Password { get; set; } = string.Empty;   // mot de passe
        public string FirstName { get; set; } = string.Empty;  // optionnel si tu veux
        public string LastName { get; set; } = string.Empty;   // optionnel
    }
}
