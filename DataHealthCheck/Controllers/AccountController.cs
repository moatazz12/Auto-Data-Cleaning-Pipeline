using DataHealthCheck.Data;
using DataHealthCheck.DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace DataHealthCheck.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AccountController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IConfiguration _configuration;

        public AccountController(
            UserManager<ApplicationUser> userManager,
            IConfiguration configuration)
        {
            _userManager = userManager;
            _configuration = configuration;
        }

        // ========= REGISTER =========
        // POST: api/Account/register
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto newUserDto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            // 1) Vérifier si le UserName existe déjà
            var existingUser = await _userManager.FindByNameAsync(newUserDto.UserName);
            if (existingUser != null)
            {
                return BadRequest("UserName existe déjà.");
            }

            // 2) Vérifier si l'email existe déjà
            var existingEmail = await _userManager.FindByEmailAsync(newUserDto.Email);
            if (existingEmail != null)
            {
                return BadRequest("Email existe déjà.");
            }

            // 3) Créer l'utilisateur
            var applicationUser = new ApplicationUser
            {
                UserName = newUserDto.UserName,
                Email = newUserDto.Email,
                FirstName = newUserDto.FirstName,
                LastName = newUserDto.LastName,
                CreatedAt = DateTime.UtcNow
            };

            var result = await _userManager.CreateAsync(applicationUser, newUserDto.Password);

            // 4) Vérifier le résultat
            if (result.Succeeded)
            {
                return Ok("User created");
            }

            // 5) Retourner les erreurs Identity
            return BadRequest(result.Errors.Select(e => new { e.Code, e.Description }));
        }

        // ========= LOGIN =========
        // POST: api/Account/login
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            // 1) Chercher l'utilisateur par UserName (comme dans ton TP)
            var user = await _userManager.FindByNameAsync(loginDto.UserName);
            if (user == null)
                return Unauthorized("Invalid credentials.");

            // 2) Vérifier le mot de passe
            var passwordOk = await _userManager.CheckPasswordAsync(user, loginDto.Password);
            if (!passwordOk)
                return Unauthorized("Invalid credentials.");

            // 3) Créer les claims
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, user.UserName ?? string.Empty),
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            // 4) Récupérer la clé secrète depuis la config
            var secret = _configuration["JWT:SecretKey"];
            if (string.IsNullOrWhiteSpace(secret))
                return StatusCode(500, "JWT:SecretKey n'est pas configurée.");

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            // 5) Créer le token
            var issuer = _configuration["JWT:issuer"];
            var audience = _configuration["JWT:audience"];

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddHours(1),
                signingCredentials: creds
            );

            var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

            // 6) Renvoyer le token au client
            return Ok(new
            {
                token = tokenString,
                expiration = token.ValidTo,
                username = user.UserName,
                email = user.Email,
                firstName = user.FirstName,
                lastName = user.LastName
            });

        }

        // GET: api/Account/users
        // Retourne la liste de tous les utilisateurs avec leurs Id et infos principales
        [HttpGet("users")]
        [Authorize] // tu peux réserver l'accès aux owners/admin plus tard
        public IActionResult GetAllUsers()
        {
            var users = _userManager.Users
                .Select(u => new
                {
                    u.Id,
                    u.UserName,
                    u.Email,
                    u.FirstName,
                    u.LastName
                })
                .ToList();

            return Ok(users);
        }

    }
}
