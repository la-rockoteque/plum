using RepositoryExample.Application;
using RepositoryExample.Domain;

namespace RepositoryExample.Infrastructure;

public sealed class InMemoryOrderRepository : IOrderRepository
{
    private readonly Dictionary<int, Order> orders = [];

    public Order? Get(int orderId) => orders.TryGetValue(orderId, out var order)
        ? new Order(order.Id, order.Status)
        : null;

    public void Save(Order order) => orders[order.Id] = new Order(order.Id, order.Status);
}
