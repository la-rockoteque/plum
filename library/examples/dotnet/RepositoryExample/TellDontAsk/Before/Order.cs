namespace RepositoryExample.TellDontAsk.Before;

// Teaching artifact: three callers each ask Order for its state, decide in their own if, and
// set the fields back. The API handler gets it right; the nightly job forgets the refund; the
// admin tool never checks whether the order already shipped.

public enum OrderStatus { Pending, Shipped, Cancelled }

public interface IClock
{
    long NowMs();
}

public sealed class Order
{
    public required int Id { get; init; }
    public required OrderStatus Status { get; set; }
    public required long AmountPaidCents { get; init; }
    public long? ShippedAtMs { get; init; }
    public long? CancelledAtMs { get; set; }
    public long RefundDueCents { get; set; }
}

// The customer-facing cancel endpoint. Gets the rule right.
public sealed class ApiCancelHandler
{
    public void Cancel(Order order, IClock clock)
    {
        if (order.Status != OrderStatus.Pending) return;
        order.Status = OrderStatus.Cancelled;
        order.CancelledAtMs = clock.NowMs();
        order.RefundDueCents = order.AmountPaidCents;
    }
}

// Auto-cancels stale pending orders. Forgot to carry the refund forward.
public sealed class NightlyCancelJob
{
    public void Cancel(Order order, IClock clock)
    {
        if (order.Status != OrderStatus.Pending) return;
        order.Status = OrderStatus.Cancelled;
        order.CancelledAtMs = clock.NowMs();
        // Bug: RefundDueCents is never set, even though the customer paid.
    }
}

// Lets support force-cancel an order by id. Never checks the current status first.
public sealed class AdminCancelTool
{
    public void Cancel(Order order, IClock clock)
    {
        // Bug: no status check, so a shipped order can be "cancelled" too.
        order.Status = OrderStatus.Cancelled;
        order.CancelledAtMs = clock.NowMs();
        order.RefundDueCents = order.AmountPaidCents;
    }
}
