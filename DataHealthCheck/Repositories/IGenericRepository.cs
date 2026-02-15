using System.Linq.Expressions;

namespace DataHealthCheck.Repositories
{
    public interface IGenericRepository<TEntity> where TEntity : class
    {
        Task<List<TEntity>> GetAllAsync();
        Task<TEntity?> GetByIdAsync(int id);
        Task<TEntity> AddAsync(TEntity entity);
        Task<bool> UpdateAsync(TEntity entity);
        Task<bool> DeleteAsync(int id);
        IQueryable<TEntity> Query(Expression<Func<TEntity, bool>>? predicate = null);
    }
}
