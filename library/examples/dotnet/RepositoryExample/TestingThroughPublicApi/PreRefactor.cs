namespace RepositoryExample.TestingThroughPublicApi;

public enum OrderStatus
{
    Pending,
    Shipped,
    Cancelled,
}

public sealed class Order(int id, int amountMinor)
{
    public int Id { get; } = id;
    public int AmountMinor { get; } = amountMinor;
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
}

public interface IOrderRepository
{
    Order FindById(int orderId);
    void Save(Order order);
}

public interface INotifier
{
    void Send(string message);
}

public sealed record CancellationOutcome(int OrderId, int RefundAmountMinor, OrderStatus Status);

// The unit's own internal collaborator: constructed by the service, never injected.
public interface INotificationFormatter
{
    string Format(int orderId, int refundAmountMinor);
}

public sealed class NotificationFormatter : INotificationFormatter
{
    public string Format(int orderId, int refundAmountMinor) => $"Order {orderId} cancelled; refund {refundAmountMinor}";
}

// Before the refactor: a separate fee helper and a plainly-named rate field.
public sealed class PreRefactorService(IOrderRepository orders, INotifier notifier)
{
    private readonly decimal _feeRate = 0.1m;
    private readonly INotificationFormatter _formatter = new NotificationFormatter();

    private int CalculateFee(Order order) => (int)Math.Round(order.AmountMinor * _feeRate);

    private static void TransitionStatus(Order order) => order.Status = OrderStatus.Cancelled;

    public CancellationOutcome Cancel(int orderId)
    {
        var order = orders.FindById(orderId);
        var fee = CalculateFee(order);
        TransitionStatus(order);
        var refund = order.AmountMinor - fee;
        notifier.Send(_formatter.Format(orderId, refund));
        orders.Save(order);
        return new CancellationOutcome(orderId, refund, order.Status);
    }
}
