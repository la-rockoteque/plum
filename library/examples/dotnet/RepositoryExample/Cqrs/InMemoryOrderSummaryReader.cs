using RepositoryExample.Domain;
using RepositoryExample.Infrastructure;

namespace RepositoryExample.Cqrs;

public sealed class InMemoryOrderSummaryReader(InMemoryOrderRepository repository) : IOrderSummaryReader
{
    public OrderSummary? GetSummary(int orderId)
    {
        var order = repository.Get(orderId);
        return order is null ? null : new OrderSummary(order.Id,
            order.Status.ToString().ToLowerInvariant(), order.Status == OrderStatus.Pending);
    }
}
