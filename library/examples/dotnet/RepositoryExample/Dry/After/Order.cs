namespace RepositoryExample.Dry.After;

// after: the rule lives once, on the order; both handlers call it.
public enum OrderStatus { Pending, Shipped, Cancelled }

public interface IClock
{
    long NowMs();
}

public sealed class Order
{
    public const long CancellationWindowMs = 24L * 60 * 60 * 1000;

    public int Id { get; }
    public OrderStatus Status { get; }
    public long PlacedAtMs { get; }

    public Order(int id, OrderStatus status, long placedAtMs)
    {
        Id = id;
        Status = status;
        PlacedAtMs = placedAtMs;
    }

    public bool CanBeCancelled(IClock clock)
    {
        if (Status != OrderStatus.Pending) return false;
        return clock.NowMs() - PlacedAtMs <= CancellationWindowMs;
    }
}

public sealed class CliCancelHandler
{
    public bool CanCancel(Order order, IClock clock) => order.CanBeCancelled(clock);
}

public sealed class ApiCancelHandler
{
    public bool CanCancel(Order order, IClock clock) => order.CanBeCancelled(clock);
}
