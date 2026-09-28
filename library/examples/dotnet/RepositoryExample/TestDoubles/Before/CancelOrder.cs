namespace RepositoryExample.TestDoubles.Before;

// Stand-in for a real SMTP client: this library never opens a socket.
public sealed class SmtpMailer
{
    public void Send(string to, string message) => throw new InvalidOperationException("network unavailable");
}

// Stand-in for a real payment-gateway HTTP client.
public sealed class HttpPaymentGateway
{
    public void Charge(int orderId, int amountMinor) => throw new InvalidOperationException("network unavailable");
}

public sealed class Order(int id, string customerEmail, int amountMinor)
{
    public int Id { get; } = id;
    public string CustomerEmail { get; } = customerEmail;
    public int AmountMinor { get; } = amountMinor;
    public string Status { get; set; } = "pending";
}

// Self-constructs its collaborators: no test can observe anything but the crash.
public sealed class CancelOrder
{
    private readonly HttpPaymentGateway _gateway = new();
    private readonly SmtpMailer _mailer = new();

    public void Execute(Order order)
    {
        _gateway.Charge(order.Id, order.AmountMinor);
        order.Status = "cancelled";
        _mailer.Send(order.CustomerEmail, $"Your order {order.Id} was cancelled");
    }
}
