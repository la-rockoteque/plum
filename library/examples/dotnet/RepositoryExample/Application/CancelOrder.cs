namespace RepositoryExample.Application;

public sealed class OrderNotFound(int id) : Exception($"Order {id} not found");

public sealed class CancelOrder(IOrderRepository repository)
{
    public void Execute(int orderId)
    {
        var order = repository.Get(orderId) ?? throw new OrderNotFound(orderId);
        order.Cancel();
        repository.Save(order);
    }
}
