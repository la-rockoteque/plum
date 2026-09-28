namespace RepositoryExample.DomainEvents.Before;

// Cancel calls three unrelated services inline — the aggregate imports all of them.
public sealed class OrderAlreadyCancelledException : Exception
{
    public OrderAlreadyCancelledException(string message) : base(message) { }
}

public interface IInventoryService
{
    void Release(int orderId);
}

public interface IMailer
{
    void SendCancellationEmail(int orderId);
}

public interface ILoyaltyLedger
{
    void RecordCancellation(int orderId);
}

// Depends on three collaborators just to change its own status.
public sealed class Order
{
    private readonly IInventoryService _inventory;
    private readonly IMailer _mailer;
    private readonly ILoyaltyLedger _loyalty;

    public int Id { get; }
    public string Status { get; private set; } = "pending";

    public Order(int id, IInventoryService inventory, IMailer mailer, ILoyaltyLedger loyalty)
    {
        Id = id;
        _inventory = inventory;
        _mailer = mailer;
        _loyalty = loyalty;
    }

    public void Cancel(string reason)
    {
        if (Status == "cancelled")
        {
            throw new OrderAlreadyCancelledException("order is already cancelled");
        }
        // If any of these three calls throws, the ones before it already ran
        // and the ones after it never will — and status is set only at the end.
        _inventory.Release(Id);
        _mailer.SendCancellationEmail(Id);
        _loyalty.RecordCancellation(Id);
        Status = "cancelled";
    }
}
