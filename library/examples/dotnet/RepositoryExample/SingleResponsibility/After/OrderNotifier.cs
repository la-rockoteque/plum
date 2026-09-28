namespace RepositoryExample.SingleResponsibility.After;

// Owns the wording of the cancellation email — its only reason to change.
public sealed class OrderNotifier
{
    public List<string> Sent { get; } = [];

    public void NotifyCancelled(Order order, string reason) =>
        Sent.Add($"Dear {order.CustomerName}, your order {order.Id} was cancelled. Reason: {reason}.");
}
