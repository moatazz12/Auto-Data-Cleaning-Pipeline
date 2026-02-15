using DataHealthCheck.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq.Expressions;

namespace DataHealthCheck.Repositories
{
    public class GenericRepository<TEntity> : IGenericRepository<TEntity> where TEntity : class
    {
        protected readonly ApplicationContext _context;
        protected readonly DbSet<TEntity> _dbSet;
        protected readonly ILogger<GenericRepository<TEntity>>? _logger;

        public GenericRepository(ApplicationContext context, ILogger<GenericRepository<TEntity>>? logger = null)
        {
            _context = context;
            _dbSet = _context.Set<TEntity>();
            _logger = logger;
        }

        public async Task<List<TEntity>> GetAllAsync()
        {
            return await _dbSet.ToListAsync();
        }

        public async Task<TEntity?> GetByIdAsync(int id)
        {
            return await _dbSet.FindAsync(id);
        }

        public async Task<TEntity> AddAsync(TEntity entity)
        {
            try
            {
                await _dbSet.AddAsync(entity);
                var changes = await _context.SaveChangesAsync();
                _logger?.LogInformation($"Entity added successfully. Changes saved: {changes}");
                return entity;
            }
            catch (DbUpdateException ex)
            {
                _logger?.LogError(ex, "Database update error while adding entity");
                throw new InvalidOperationException($"Erreur lors de l'ajout de l'entité: {ex.InnerException?.Message ?? ex.Message}", ex);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Unexpected error while adding entity");
                throw;
            }
        }

        public async Task<bool> UpdateAsync(TEntity entity)
        {
            try
            {
                _dbSet.Update(entity);
                var changes = await _context.SaveChangesAsync();
                _logger?.LogInformation($"Entity updated successfully. Changes saved: {changes}");
                return true;
            }
            catch (DbUpdateException ex)
            {
                _logger?.LogError(ex, "Database update error while updating entity");
                throw new InvalidOperationException($"Erreur lors de la mise à jour de l'entité: {ex.InnerException?.Message ?? ex.Message}", ex);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Unexpected error while updating entity");
                throw;
            }
        }

        public async Task<bool> DeleteAsync(int id)
        {
            try
            {
                var existing = await _dbSet.FindAsync(id);
                if (existing == null) return false;

                _dbSet.Remove(existing);
                var changes = await _context.SaveChangesAsync();
                _logger?.LogInformation($"Entity deleted successfully. Changes saved: {changes}");
                return true;
            }
            catch (DbUpdateException ex)
            {
                _logger?.LogError(ex, "Database update error while deleting entity");
                throw new InvalidOperationException($"Erreur lors de la suppression de l'entité: {ex.InnerException?.Message ?? ex.Message}", ex);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Unexpected error while deleting entity");
                throw;
            }
        }

        public IQueryable<TEntity> Query(Expression<Func<TEntity, bool>>? predicate = null)
        {
            return predicate == null ? _dbSet : _dbSet.Where(predicate);
        }
    }
}





