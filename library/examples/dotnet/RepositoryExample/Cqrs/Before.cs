using RepositoryExample.Application;
using RepositoryExample.Domain;

namespace RepositoryExample.Cqrs.Before;

public sealed class OrderService(IOrderRepository repository)
{
    public Order CancelAndGet(int orderId)
    {
        // One operation changes state and returns the write model to the caller.
        var order = repository.Get(orderId) ?? throw new OrderNotFound(orderId);
        order.Cancel();
        repository.Save(order);
        return order;
    }
}
