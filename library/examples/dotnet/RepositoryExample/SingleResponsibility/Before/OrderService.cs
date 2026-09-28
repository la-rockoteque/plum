namespace RepositoryExample.SingleResponsibility.Before;

public sealed class Order
{
    public required string Id { get; init; }
    public required string CustomerName { get; init; }
    public required string CustomerEmail { get; init; }
    public string Status { get; set; } = "pending";
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
        if (order.Status == "shipped")
            throw new InvalidOperationException("cannot cancel a shipped order");
        order.Status = "cancelled";
        SentEmails.Add($"Dear {order.CustomerName}, your order {order.Id} was cancelled. Reason: {reason}.");
        AuditLog.Add($"{order.Id}|CANCELLED|{reason}");
    }
}
