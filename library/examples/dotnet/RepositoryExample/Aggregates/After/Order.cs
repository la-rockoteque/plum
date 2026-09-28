namespace RepositoryExample.Aggregates.After;

public sealed class OrderCancelledException : Exception
{
    public OrderCancelledException(string message) : base(message) { }
}

public sealed class InvalidQuantityException : Exception
{
    public InvalidQuantityException(string message) : base(message) { }
}

public sealed class TooManyLinesException : Exception
{
    public TooManyLinesException(string message) : base(message) { }
}

public sealed class LineNotFoundException : Exception
{
    public LineNotFoundException(string message) : base(message) { }
}

// Held only inside the aggregate; callers only ever see copies of it.
public sealed class OrderLine
{
    public int Id { get; init; }
    public string Sku { get; init; } = "";
    public int Quantity { get; set; }
    public long UnitPriceMinor { get; init; }
    public string Currency { get; init; } = "USD";

    public OrderLine Copy() => new()
    {
        Id = Id,
        Sku = Sku,
        Quantity = Quantity,
        UnitPriceMinor = UnitPriceMinor,
        Currency = Currency,
    };
}

// The aggregate root: the only entry point for reading or changing its lines.
public sealed class Order
{
    private const int MaxLines = 10;

    private readonly List<OrderLine> _lines = new();
    private readonly string _currency;
    private int _nextLineId = 1;

    public int Id { get; }
    public string Status { get; private set; } = "pending";

    public Order(int id, string currency = "USD")
    {
        Id = id;
        _currency = currency;
    }

    // Returns copies: mutating the result can never change the aggregate's state.
    public List<OrderLine> Lines => _lines.Select(line => line.Copy()).ToList();

    // Always derived from the current lines — never a cache that can go stale.
    public long TotalMinor => _lines.Sum(line => (long)line.Quantity * line.UnitPriceMinor);

    public int AddLine(string sku, int quantity, long unitPriceMinor)
    {
        GuardNotCancelled();
        GuardQuantity(quantity);
        if (_lines.Count >= MaxLines)
        {
            throw new TooManyLinesException($"an order can have at most {MaxLines} lines");
        }
        var line = new OrderLine { Id = _nextLineId, Sku = sku, Quantity = quantity, UnitPriceMinor = unitPriceMinor, Currency = _currency };
        _nextLineId++;
        _lines.Add(line);
        return line.Id;
    }

    public void ChangeQuantity(int lineId, int quantity)
    {
        GuardNotCancelled();
        GuardQuantity(quantity);
        Find(lineId).Quantity = quantity;
    }

    public void RemoveLine(int lineId)
    {
        GuardNotCancelled();
        _lines.Remove(Find(lineId));
    }

    public void Cancel() => Status = "cancelled";

    private OrderLine Find(int lineId) =>
        _lines.FirstOrDefault(line => line.Id == lineId)
            ?? throw new LineNotFoundException($"no such line: {lineId}");

    private void GuardNotCancelled()
    {
        if (Status == "cancelled")
        {
            throw new OrderCancelledException("cannot modify a cancelled order");
        }
    }

    private static void GuardQuantity(int quantity)
    {
        if (quantity < 1)
        {
            throw new InvalidQuantityException("quantity must be at least 1");
        }
    }
}

// One repository per aggregate: it saves and loads the whole Order, not individual lines.
public sealed class OrderRepository
{
    private readonly Dictionary<int, Order> _orders = new();

    public void Save(Order order) => _orders[order.Id] = order;

    public Order? Get(int orderId) => _orders.GetValueOrDefault(orderId);
}
