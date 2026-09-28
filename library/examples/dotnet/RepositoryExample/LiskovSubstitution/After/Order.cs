namespace RepositoryExample.LiskovSubstitution.After;

public enum OrderStatus { Pending, Shipped, Cancelled }

// The shape every order variant shares. Cancellation is not part of it:
// it's a separate capability below.
public interface IOrder
{
    int Id { get; }
    OrderStatus Status { get; }
}

// The capability a caller actually needs: only order types that can honour
// it (pending -> cancelled, shipped/cancelled -> rejected) implement it.
public interface ICancellableOrder : IOrder
{
    void Cancel(string reason);
}

public class StandardOrder : ICancellableOrder
{
    public required int Id { get; init; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;

    public void Cancel(string reason)
    {
        if (Status is OrderStatus.Shipped or OrderStatus.Cancelled)
            throw new InvalidOperationException("cannot cancel a shipped or cancelled order");
        Status = OrderStatus.Cancelled;
    }
}

// A second, independent type that satisfies ICancellableOrder the same way
// StandardOrder does — proving the contract, not a single class, is what
// callers depend on.
public sealed class SubscriptionOrder : StandardOrder;

// Shares IOrder's shape (Id, Status) but has no Cancel method: it does not
// implement ICancellableOrder at all. The domain still considers it an
// order; the type system no longer lets it reach Cancel.
public sealed class GiftOrder : IOrder
{
    public required int Id { get; init; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
}
