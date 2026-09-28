namespace RepositoryExample.TestingThroughPublicApi;

public sealed class Order(string id, decimal total)
{
    public string Id { get; } = id;
    public decimal Total { get; } = total;
    public string Status { get; set; } = "placed";
}

public interface IOrderRepository
{
    Order FindById(string orderId);
    void Save(Order order);
}

public interface INotifier
{
    void Send(string message);
}

public sealed record CancellationOutcome(string OrderId, decimal RefundAmount, string Status);

// The unit's own internal collaborator: constructed by the service, never injected.
public interface INotificationFormatter
{
    string Format(string orderId, decimal refundAmount);
}

public sealed class NotificationFormatter : INotificationFormatter
{
    public string Format(string orderId, decimal refundAmount) => $"Order {orderId} cancelled; refund {refundAmount:F2}";
}

// Before the refactor: a separate fee helper and a plainly-named rate field.
public sealed class PreRefactorService(IOrderRepository orders, INotifier notifier)
{
    private readonly decimal _feeRate = 0.1m;
    private readonly INotificationFormatter _formatter = new NotificationFormatter();

    private decimal CalculateFee(Order order) => Math.Round(order.Total * _feeRate, 2);

    private static void TransitionStatus(Order order) => order.Status = "cancelled";

    public CancellationOutcome Cancel(string orderId)
    {
        var order = orders.FindById(orderId);
        var fee = CalculateFee(order);
        TransitionStatus(order);
        var refund = Math.Round(order.Total - fee, 2);
        notifier.Send(_formatter.Format(orderId, refund));
        orders.Save(order);
        return new CancellationOutcome(orderId, refund, order.Status);
    }
}
