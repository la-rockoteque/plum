using RepositoryExample.Domain;

namespace RepositoryExample.Application;

// Get returns a detached entity; Save inserts or updates by ID.
public interface IOrderRepository
{
    Order? Get(int orderId);
    void Save(Order order);
}
