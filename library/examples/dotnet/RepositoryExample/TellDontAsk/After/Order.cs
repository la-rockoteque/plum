namespace RepositoryExample.TellDontAsk.After;

// Callers tell the order to cancel itself; Order owns the rule, the timestamp and the refund.
// Setters disappear, and the invalid transition (cancelling a shipped order) is rejected once,
// inside Order, instead of missed by whichever caller forgot to check.

public enum OrderStatus { Pending, Shipped, Cancelled }

public interface IClock
{
    long NowMs();
}

public sealed class Order
{
    public Order(int id, OrderStatus status, long amountPaidCents, long? shippedAtMs = null)
    {
        Id = id;
        Status = status;
        AmountPaidCents = amountPaidCents;
        ShippedAtMs = shippedAtMs;
    }

    public int Id { get; }
    public long AmountPaidCents { get; }
    public long? ShippedAtMs { get; }
    public OrderStatus Status { get; private set; }
    public long? CancelledAtMs { get; private set; }
    public long RefundDueCents { get; private set; }

    public void Cancel(IClock clock)
    {
        if (Status != OrderStatus.Pending)
            throw new InvalidOperationException($"cannot cancel an order with status {Status}");
        Status = OrderStatus.Cancelled;
        CancelledAtMs = clock.NowMs();
        RefundDueCents = AmountPaidCents;
    }
}

public sealed class ApiCancelHandler
{
    public void Cancel(Order order, IClock clock) => order.Cancel(clock);
}

public sealed class NightlyCancelJob
{
    public void Cancel(Order order, IClock clock) => order.Cancel(clock);
}

public sealed class AdminCancelTool
{
    public void Cancel(Order order, IClock clock) => order.Cancel(clock);
}
