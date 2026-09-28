namespace RepositoryExample.SingleResponsibility.After;

// Owns only the cancellation rule; notifying and auditing are delegated to
// its collaborators.
public sealed class CancelOrder(OrderNotifier notifier, AuditLog auditLog)
{
    public void Execute(Order order, string reason)
    {
        if (order.Status == "shipped")
            throw new InvalidOperationException("cannot cancel a shipped order");
        order.Status = "cancelled";
        notifier.NotifyCancelled(order, reason);
        auditLog.RecordCancelled(order, reason);
    }
}
