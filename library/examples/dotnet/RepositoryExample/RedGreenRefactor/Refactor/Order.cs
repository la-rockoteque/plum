namespace RepositoryExample.RedGreenRefactor.Refactor;

public enum OrderStatus
{
    Pending,
    Shipped,
    Cancelled,
}

// Same behaviour as Green, named and in one place.
public sealed class Order(OrderStatus status = OrderStatus.Pending)
{
    private static readonly HashSet<OrderStatus> NonCancellableStatuses = [OrderStatus.Shipped];

    public OrderStatus Status { get; private set; } = status;

    public bool CanCancel() => !NonCancellableStatuses.Contains(Status);

    public void Cancel()
    {
        if (!CanCancel()) throw new InvalidOperationException("a shipped order can't be cancelled");
        Status = OrderStatus.Cancelled;
    }
}
