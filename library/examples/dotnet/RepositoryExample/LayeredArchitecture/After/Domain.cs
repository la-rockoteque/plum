namespace RepositoryExample.LayeredArchitecture.After;

public enum OrderStatus { Pending, Shipped, Cancelled }

public sealed class OrderCannotBeCancelled(int id, OrderStatus status)
    : Exception($"order {id} already {status}");

public sealed class Order(int id, OrderStatus status = OrderStatus.Pending)
{
    public int Id { get; } = id;
    public OrderStatus Status { get; private set; } = status;

    public void Cancel()
    {
        if (Status is OrderStatus.Shipped or OrderStatus.Cancelled)
            throw new OrderCannotBeCancelled(Id, Status);
        Status = OrderStatus.Cancelled;
    }
}
