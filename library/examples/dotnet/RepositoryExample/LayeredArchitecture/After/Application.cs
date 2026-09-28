namespace RepositoryExample.LayeredArchitecture.After;

// Port owned by the application layer. Data adapters implement it.
public interface IOrderRepository
{
    Order? Get(int orderId);
    void Save(Order order);
}

public sealed class OrderNotFound(int id) : Exception($"order {id} not found");

// Application service: loads the aggregate, calls domain behaviour, saves it.
public sealed class CancelOrder(IOrderRepository repository) : ICancelOrderUseCase
{
    public void Execute(int orderId)
    {
        var order = repository.Get(orderId) ?? throw new OrderNotFound(orderId);
        order.Cancel();
        repository.Save(order);
    }
}
