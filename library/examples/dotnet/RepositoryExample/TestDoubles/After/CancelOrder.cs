namespace RepositoryExample.TestDoubles.After;

public enum OrderStatus { Pending, Shipped, Cancelled }

public enum ChargeResult { Approved, Declined }

public sealed class Order(int id, string customerEmail, int amountMinor)
{
    public int Id { get; } = id;
    public string CustomerEmail { get; } = customerEmail;
    public int AmountMinor { get; } = amountMinor;
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
}

public interface IOrderRepository
{
    Order Get(int orderId);
    void Save(Order order);
}

public interface IPaymentGateway
{
    ChargeResult Charge(int orderId, int amountMinor);
}

public interface IMailer
{
    void Send(string to, string message);
}

public interface IAuditLogger
{
    void Log(string message);
}

// Every collaborator is a port; the composition root decides which double or adapter plugs in.
public sealed class CancelOrder(
    IOrderRepository orders,
    IPaymentGateway gateway,
    IMailer mailer,
    IAuditLogger auditLogger)
{
    public void Execute(int orderId)
    {
        var order = orders.Get(orderId);
        var result = gateway.Charge(order.Id, order.AmountMinor);
        if (result == ChargeResult.Declined)
        {
            // A declined charge is a legitimate business outcome, not a crash: the audit
            // logger is a real collaborator on this path, even though the happy path
            // never touches it.
            auditLogger.Log($"charge declined for order {order.Id}");
            return;
        }
        order.Status = OrderStatus.Cancelled;
        mailer.Send(order.CustomerEmail, $"Your order {order.Id} was cancelled");
        orders.Save(order);
    }
}
