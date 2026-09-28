namespace RepositoryExample.Aggregates.After;

public enum OrderStatus { Pending, Shipped, Cancelled }

public sealed class OrderCancelledException(string message) : Exception(message);
public sealed class InvalidQuantityException(string message) : Exception(message);
public sealed class TooManyLinesException(string message) : Exception(message);
public sealed class LineNotFoundException(string message) : Exception(message);
public sealed class CurrencyMismatchException(string message) : Exception(message);

// Held only inside the aggregate; callers only ever see copies of it.
public sealed class OrderLine
{
    public int Id { get; init; }
    public string Sku { get; init; } = "";
    public int Quantity { get; set; }
    public long UnitPriceMinor { get; init; }

    public OrderLine Copy() => new() { Id = Id, Sku = Sku, Quantity = Quantity, UnitPriceMinor = UnitPriceMinor };
}

// The aggregate root: the only entry point for reading or changing its lines.
public sealed class Order
{
    private const int MaxLines = 10;

    private readonly List<OrderLine> _lines = new();
    private readonly string _currency;
    private int _nextLineId = 1;

    public int Id { get; }
    public OrderStatus Status { get; private set; }

    public Order(int id, string currency = "USD", OrderStatus status = OrderStatus.Pending)
    {
        Id = id;
        _currency = currency;
        Status = status;
    }

    // Returns copies: mutating the result can never change the aggregate's state.
    public List<OrderLine> Lines => _lines.Select(line => line.Copy()).ToList();

    // Always derived from the current lines — never a cache that can go stale.
    public long TotalMinor => _lines.Sum(line => (long)line.Quantity * line.UnitPriceMinor);

    public int AddLine(string sku, int quantity, long unitPriceMinor, string currency)
    {
        Guard(quantity);
        if (currency != _currency) throw new CurrencyMismatchException($"line currency {currency} does not match order currency {_currency}");
        if (_lines.Count >= MaxLines) throw new TooManyLinesException($"an order can have at most {MaxLines} lines");
        var line = new OrderLine { Id = _nextLineId, Sku = sku, Quantity = quantity, UnitPriceMinor = unitPriceMinor };
        _nextLineId++;
        _lines.Add(line);
        return line.Id;
    }

    public void ChangeQuantity(int lineId, int quantity)
    {
        Guard(quantity);
        Find(lineId).Quantity = quantity;
    }

    // Enforces the aggregate's own invariant: a shipped or already-cancelled order can't be cancelled.
    public void Cancel()
    {
        if (Status != OrderStatus.Pending) throw new OrderCancelledException("cannot cancel a shipped or already-cancelled order");
        Status = OrderStatus.Cancelled;
    }

    // Detached copy: used by the repository so a stored order is never a live reference.
    public Order Copy()
    {
        var clone = new Order(Id, _currency, Status);
        clone._lines.AddRange(Lines);
        clone._nextLineId = _nextLineId;
        return clone;
    }

    private OrderLine Find(int lineId) =>
        _lines.FirstOrDefault(line => line.Id == lineId) ?? throw new LineNotFoundException($"no such line: {lineId}");

    private void Guard(int quantity)
    {
        if (Status == OrderStatus.Cancelled) throw new OrderCancelledException("cannot modify a cancelled order");
        if (quantity < 1) throw new InvalidQuantityException("quantity must be at least 1");
    }
}

// One repository per aggregate: it saves and loads the whole Order, not individual lines.
public sealed class OrderRepository
{
    private readonly Dictionary<int, Order> _orders = new();

    public void Save(Order order) => _orders[order.Id] = order.Copy();

    public Order? Get(int orderId) => _orders.TryGetValue(orderId, out var order) ? order.Copy() : null;
}
