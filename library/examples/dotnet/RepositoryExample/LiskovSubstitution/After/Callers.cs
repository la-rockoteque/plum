namespace RepositoryExample.LiskovSubstitution.After;

// Depends only on ICancellableOrder, so it works for every subtype that
// implements it — no type check, and no way to hand it a GiftOrder by
// mistake.
public sealed class CancelExpiredOrders
{
    public List<int> Execute(IEnumerable<ICancellableOrder> orders, string reason)
    {
        var cancelled = new List<int>();
        foreach (var order in orders)
        {
            order.Cancel(reason);
            cancelled.Add(order.Id);
        }
        return cancelled;
    }
}

// Same capability, same absence of type checks.
public sealed class CustomerServiceCancelTool
{
    public string Cancel(ICancellableOrder order, string reason)
    {
        order.Cancel(reason);
        return $"order {order.Id} cancelled: {reason}";
    }
}
