using DataHealthCheck.Data;
using Metiers;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace DataHealthCheck.Data
{
    public class ApplicationContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationContext(DbContextOptions<ApplicationContext> options)
            : base(options)
        {
        }

        public DbSet<Workspace> Workspaces { get; set; } = null!;
        public DbSet<WorkspaceMember> WorkspaceMembers { get; set; } = null!;
        public DbSet<AnalysisSession> AnalysisSessions { get; set; } = null!;
        public DbSet<DataQualityMetric> DataQualityMetrics { get; set; } = null!;
        public DbSet<CleanedDataset> CleanedDatasets { get; set; } = null!;
        public DbSet<Commentaire> Commentaires { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            // Workspace.OwnerId → ApplicationUser.Id
            builder.Entity<Workspace>()
                .HasOne<ApplicationUser>()                // pas de nav dans Workspace
                .WithMany()                               // pas de collection dans ApplicationUser
                .HasForeignKey(w => w.OwnerId)
                .HasPrincipalKey(u => u.Id);

            // WorkspaceMember.UserId → ApplicationUser.Id
            builder.Entity<WorkspaceMember>()
                .HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(wm => wm.UserId)
                .HasPrincipalKey(u => u.Id);

            // CleanedDataset.CleanedBy → ApplicationUser.Id
            builder.Entity<CleanedDataset>()
                .HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(cd => cd.CleanedBy)
                .HasPrincipalKey(u => u.Id);

            // CleanedDataset.OriginalSessionId → AnalysisSession.Id
            builder.Entity<CleanedDataset>()
                .HasOne<AnalysisSession>()
                .WithMany()
                .HasForeignKey(cd => cd.OriginalSessionId)
                .OnDelete(DeleteBehavior.Restrict); // Empêche la suppression en cascade

            // Commentaire.UserId → ApplicationUser.Id
            builder.Entity<Commentaire>()
                .HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(c => c.UserId)
                .HasPrincipalKey(u => u.Id);

            // DataQualityMetric.AnalysisSessionId → AnalysisSession.Id
            builder.Entity<DataQualityMetric>()
                .HasOne<AnalysisSession>()
                .WithMany()
                .HasForeignKey(dqm => dqm.AnalysisSessionId)
                .OnDelete(DeleteBehavior.Cascade); // Supprime les métriques si la session est supprimée

            // Configuration de QualityScore : decimal(4,3) pour permettre 0.000 à 1.000
            builder.Entity<DataQualityMetric>()
                .Property(dqm => dqm.QualityScore)
                .HasPrecision(4, 3)
                .HasColumnType("decimal(4,3)");

            // Commentaire.AnalysisSessionId → AnalysisSession.Id
            builder.Entity<Commentaire>()
                .HasOne<AnalysisSession>()
                .WithMany()
                .HasForeignKey(c => c.AnalysisSessionId)
                .OnDelete(DeleteBehavior.Cascade);

            // AnalysisSession.WorkspaceId → Workspace.Id
            builder.Entity<AnalysisSession>()
                .HasOne<Workspace>()
                .WithMany()
                .HasForeignKey(session => session.WorkspaceId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
