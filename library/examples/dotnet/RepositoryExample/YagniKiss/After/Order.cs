namespace RepositoryExample.YagniKiss.After;

// after: delete down to what's actually called — one method with the rule.
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
