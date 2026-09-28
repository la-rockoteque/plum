namespace RepositoryExample.InterfaceSegregation.Before;

public sealed class Order(int id, string customerEmail, int amountMinor)
{
    public int Id { get; } = id;
    public string CustomerEmail { get; } = customerEmail;
    public int AmountMinor { get; } = amountMinor;
    public string Status { get; set; } = "pending";
}

// The only persistence contract available. CancelOrder depends on all seven members
// below even though it only ever calls two of them.
public interface IOrderStoreV1
{
    Order Get(int orderId);
    void Save(Order order);
    void Delete(int orderId);
    List<Order> ListByCustomer(string customerEmail);
    string ExportCsv();
    List<string> AuditTrail(int orderId);
    int PurgeOlderThan(int days);
}

// The fat interface grows an eighth member. Every implementer -- including a fake
// written for a use case that never touches archiving -- must grow with it.
public interface IOrderStoreV2 : IOrderStoreV1
{
    void Archive(int orderId);
}

// Depends on the whole fat interface, though it only ever calls Get and Save.
public sealed class CancelOrder(IOrderStoreV1 store)
{
    public void Execute(int orderId)
    {
        var order = store.Get(orderId);
        order.Status = "cancelled";
        store.Save(order);
    }
}
