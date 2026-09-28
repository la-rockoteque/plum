namespace RepositoryExample.InterfaceSegregation.After;

public sealed class Order(int id, string customerEmail, int amountMinor)
{
    public int Id { get; } = id;
    public string CustomerEmail { get; } = customerEmail;
    public int AmountMinor { get; } = amountMinor;
    public string Status { get; set; } = "pending";
}

// A role interface owned by CancelOrder: only what it needs, declared next to it.
public interface ICancelOrderStore
{
    Order Get(int orderId);
    void Save(Order order);
}

// A separate role interface for a different client. CancelOrder never sees it.
public interface IOrderArchiver
{
    void Archive(int orderId);
}

public sealed class CancelOrder(ICancelOrderStore store)
{
    public void Execute(int orderId)
    {
        var order = store.Get(orderId);
        order.Status = "cancelled";
        store.Save(order);
    }
}

// The concrete adapter implements several role interfaces at once; CancelOrder only
// ever depends on the narrow one (ICancelOrderStore).
public sealed class OrderStoreAdapter : ICancelOrderStore, IOrderArchiver
{
    private readonly Dictionary<int, Order> _orders = [];

    public Order Get(int orderId) => _orders[orderId];

    public void Save(Order order) => _orders[order.Id] = order;

    public void Archive(int orderId) => Get(orderId).Status = "archived";
}
