using DataHealthCheck.Data;
using DataHealthCheck.Repositories;
using DataHealthCheck.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.IO;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

var dataProtectionPath = Path.Combine(builder.Environment.ContentRootPath, "App_Data", "DataProtectionKeys");
Directory.CreateDirectory(dataProtectionPath);

// ===== 1) DB CONTEXT =====
builder.Services.AddDbContext<ApplicationContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("cnx"))
);

// ===== 2) IDENTITY =====
builder.Services.AddIdentity<ApplicationUser, IdentityRole>()
    .AddEntityFrameworkStores<ApplicationContext>()
    .AddDefaultTokenProviders();

// ===== 3) AUTHENTICATION JWT =====
var jwtSettings = builder.Configuration.GetSection("JWT");
var secretKey = jwtSettings["SecretKey"];

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false; // en dev avec http
    options.SaveToken = true;

    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["issuer"],      // ex: "http://localhost:5111"
        ValidAudience = jwtSettings["audience"],  // ex: "http://localhost:5111"
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(secretKey!)
        )
    };
});

// ===== 4) SERVICES METIERS & REPOSITORY =====
builder.Services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));
builder.Services.AddSingleton<IDataQualityMetricsService, DataQualityMetricsService>();
builder.Services.AddSingleton<IDataCleaningService, DataCleaningService>();

// Ajouter le logging
builder.Services.AddLogging();
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionPath))
    .SetApplicationName("DataHealthCheck");
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// ===== 5) SWAGGER + JWT (bouton Authorize) =====
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "DataHealthCheck API",
        Version = "v1"
    });

    var securityScheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Entrez 'Bearer {votre token JWT}'"
    };

    options.AddSecurityDefinition("Bearer", securityScheme);

    var securityRequirement = new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    };

    options.AddSecurityRequirement(securityRequirement);
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
        policy.WithOrigins("http://localhost:4200", "https://datahealthcheck-99603.web.app")
              .AllowAnyHeader()
              .AllowAnyMethod());
});
var app = builder.Build();


// ===== 6) MIDDLEWARE PIPELINE =====
app.UseDeveloperExceptionPage(); // Pour voir l'erreur réelle sur MonsterASP

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// pas de HTTPS redirection pour rester en http://localhost:5111
app.UseAuthentication();      // avant UseAuthorization
app.UseCors("AllowAngular");
app.UseAuthorization();

app.MapControllers();

// ===== 7) DATABASE INITIALIZATION =====
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationContext>();
        context.Database.EnsureCreated(); // Crée les tables si elles n'existent pas
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Erreur lors de l'initialisation de la base de données.");
    }
}

app.Run();
