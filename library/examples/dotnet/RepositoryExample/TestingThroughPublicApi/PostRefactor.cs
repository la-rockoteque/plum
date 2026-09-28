namespace RepositoryExample.TestingThroughPublicApi;

// After a behaviour-preserving refactor: the fee helper is inlined and the rate field renamed.
// A caller of Cancel cannot tell this apart from PreRefactorService - same inputs, same outcome,
// same stored state, same notification. Only the private shape changed.
public sealed class PostRefactorService(IOrderRepository orders, INotifier notifier)
{
    private readonly decimal _cancellationFeeRate = 0.1m;
    private readonly INotificationFormatter _formatter = new NotificationFormatter();

    private static void TransitionStatus(Order order) => order.Status = "cancelled";

    public CancellationOutcome Cancel(string orderId)
    {
        var order = orders.FindById(orderId);
        var fee = Math.Round(order.Total * _cancellationFeeRate, 2); // CalculateFee() inlined here
        TransitionStatus(order);
        var refund = Math.Round(order.Total - fee, 2);
        notifier.Send(_formatter.Format(orderId, refund));
        orders.Save(order);
        return new CancellationOutcome(orderId, refund, order.Status);
    }
}
