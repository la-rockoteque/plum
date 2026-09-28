namespace RepositoryExample.SingleResponsibility.Before;

public enum OrderStatus { Pending, Shipped, Cancelled }

public sealed class Order
{
    public required int Id { get; init; }
    public required string CustomerName { get; init; }
    public required string CustomerEmail { get; init; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
}

// Cancels an order, formats the customer email, and writes the audit log —
// three reasons to change: the cancellation rule, the email wording, and the
// audit format.
public sealed class OrderService
{
    public List<string> SentEmails { get; } = [];
    public List<string> AuditLog { get; } = [];

    public void Cancel(Order order, string reason)
    {
        if (order.Status is OrderStatus.Shipped or OrderStatus.Cancelled)
            throw new InvalidOperationException("cannot cancel a shipped or cancelled order");
        order.Status = OrderStatus.Cancelled;
        SentEmails.Add($"Dear {order.CustomerName}, your order {order.Id} was cancelled. Reason: {reason}.");
        AuditLog.Add($"{order.Id}|CANCELLED|{reason}");
    }
}
