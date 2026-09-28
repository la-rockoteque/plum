namespace RepositoryExample.Domain;

public enum OrderStatus { Pending, Cancelled }

public sealed class OrderAlreadyCancelled(int id)
    : Exception($"Order {id} already cancelled");

public sealed class Order(int id, OrderStatus status = OrderStatus.Pending)
{
    public int Id { get; } = id;
    public OrderStatus Status { get; private set; } = status;

    public void Cancel()
    {
        if (Status == OrderStatus.Cancelled)
            throw new OrderAlreadyCancelled(Id);
        Status = OrderStatus.Cancelled;
    }
}
