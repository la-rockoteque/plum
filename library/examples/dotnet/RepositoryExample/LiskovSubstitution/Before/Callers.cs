namespace RepositoryExample.LiskovSubstitution.Before;

// Written against the Order contract. Because GiftOrder strengthens that
// contract's precondition, this caller has to know about GiftOrder by name
// to avoid the broken cancellation.
public sealed class CancelExpiredOrders
{
    public (List<int> Cancelled, List<int> Skipped) Execute(IEnumerable<Order> orders, string reason)
    {
        var cancelled = new List<int>();
        var skipped = new List<int>();
        foreach (var order in orders)
        {
            if (order is GiftOrder)
            {
                skipped.Add(order.Id);
                continue;
            }
            order.Cancel(reason);
            cancelled.Add(order.Id);
        }
        return (cancelled, skipped);
    }
}

// A second caller against the same Order contract, forced to grow the same
// type check as CancelExpiredOrders — the change cost of the violation is
// paid twice.
public sealed class CustomerServiceCancelTool
{
    public string Cancel(Order order, string reason)
    {
        if (order is GiftOrder)
            return $"order {order.Id} must be cancelled by phone: gift orders can't be cancelled online";
        order.Cancel(reason);
        return $"order {order.Id} cancelled: {reason}";
    }
}
