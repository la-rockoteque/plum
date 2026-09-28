namespace RepositoryExample.TestDoubles.After;

public sealed class Order(string id, string customerEmail, decimal cancellationFee)
{
    public string Id { get; } = id;
    public string CustomerEmail { get; } = customerEmail;
    public decimal CancellationFee { get; } = cancellationFee;
    public string Status { get; set; } = "placed";
}

public interface IOrderRepository
{
    Order FindById(string orderId);
    void Save(Order order);
}

public interface IPaymentGateway
{
    void Charge(string orderId, decimal amount);
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
    IAuditLogger auditLogger) // never called: a dummy satisfies this parameter in tests
{
    public void Execute(string orderId)
    {
        var order = orders.FindById(orderId);
        gateway.Charge(order.Id, order.CancellationFee);
        order.Status = "cancelled";
        mailer.Send(order.CustomerEmail, $"Your order {order.Id} was cancelled");
        orders.Save(order);
    }
}
