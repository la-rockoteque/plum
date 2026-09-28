namespace RepositoryExample.SingleResponsibility.After;

public interface INotifier
{
    void NotifyCancelled(Order order, string reason);
}

public interface IAuditor
{
    void RecordCancelled(Order order, string reason);
}

// Owns only the cancellation rule; notifying and auditing are delegated to
// ports it declares, not to concrete collaborators.
public sealed class CancelOrder(INotifier notifier, IAuditor auditLog)
{
    public void Execute(Order order, string reason)
    {
        if (order.Status is OrderStatus.Shipped or OrderStatus.Cancelled)
            throw new InvalidOperationException("cannot cancel a shipped or cancelled order");
        order.Status = OrderStatus.Cancelled;
        notifier.NotifyCancelled(order, reason);
        auditLog.RecordCancelled(order, reason);
    }
}
