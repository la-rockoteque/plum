namespace RepositoryExample.LiskovSubstitution.Before;

public enum OrderStatus { Pending, Shipped, Cancelled }

public class Order
{
    public required int Id { get; init; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;

    public virtual void Cancel(string reason)
    {
        if (Status is OrderStatus.Shipped or OrderStatus.Cancelled)
            throw new InvalidOperationException("cannot cancel a shipped or cancelled order");
        Status = OrderStatus.Cancelled;
    }
}

// Strengthens Order's precondition: Cancel rejects every request, even
// while pending, where the base class would accept it. A caller that only
// knows the Order contract can no longer assume cancelling a pending order
// succeeds.
public sealed class GiftOrder : Order
{
    public override void Cancel(string reason) =>
        throw new InvalidOperationException("gift orders can't be cancelled online");
}
