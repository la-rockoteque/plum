namespace RepositoryExample.Aggregates.Before;

// A line entity with its own identity — nothing stops a caller reaching it directly.
public sealed class OrderLine
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public string Sku { get; set; } = "";
    public int Quantity { get; set; }
    public long UnitPriceMinor { get; set; }
    public string Currency { get; set; } = "USD";
}

// Lines get their own repository/collection, so callers can bypass the order entirely.
public sealed class OrderLineRepository
{
    private readonly Dictionary<int, OrderLine> _lines = new();

    public void Add(OrderLine line) => _lines[line.Id] = line;

    public void UpdateQuantity(int lineId, int quantity) => _lines[lineId].Quantity = quantity;

    public void Remove(int lineId) => _lines.Remove(lineId);

    public List<OrderLine> ForOrder(int orderId) =>
        _lines.Values.Where(line => line.OrderId == orderId).ToList();
}

// TotalMinor is a cache: correct only if every caller remembers to refresh it.
public sealed class Order
{
    public int Id { get; set; }
    public string Status { get; set; } = "pending";
    public long TotalMinor { get; set; }
    public string Currency { get; set; } = "USD";
}

public static class Totals
{
    // Refreshes the cached total from the current lines — easy to forget to call.
    public static void RecomputeTotal(Order order, List<OrderLine> lines) =>
        order.TotalMinor = lines.Sum(line => (long)line.Quantity * line.UnitPriceMinor);
}
