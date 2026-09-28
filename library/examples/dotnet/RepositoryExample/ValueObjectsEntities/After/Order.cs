namespace RepositoryExample.ValueObjectsEntities.After;

public sealed class InvalidStatusTransitionException : Exception
{
    public InvalidStatusTransitionException(string message) : base(message) { }
}

// A value object: only these states exist, and only some moves between them are legal.
public enum OrderStatus
{
    Pending,
    Cancelled,
}

public static class OrderStatuses
{
    public static OrderStatus Parse(string value) => value switch
    {
        "pending" => OrderStatus.Pending,
        "cancelled" => OrderStatus.Cancelled,
        _ => throw new InvalidStatusTransitionException($"Unknown order status: {value}"),
    };

    public static OrderStatus TransitionTo(this OrderStatus status, OrderStatus target)
    {
        if (status == OrderStatus.Pending && target == OrderStatus.Cancelled)
        {
            return target;
        }
        throw new InvalidStatusTransitionException($"Cannot move from {status} to {target}");
    }
}

public sealed class CurrencyMismatchException : Exception
{
    public CurrencyMismatchException(string message) : base(message) { }
}

// A value object: an immutable record, compared by value, and blind to arithmetic across currencies.
public sealed record Money(long AmountMinor, string Currency)
{
    public Money Add(Money other)
    {
        if (other.Currency != Currency)
        {
            throw new CurrencyMismatchException($"Cannot add {other.Currency} to {Currency}");
        }
        return this with { AmountMinor = AmountMinor + other.AmountMinor };
    }
}

// An entity: two Orders are the same order iff they share an Id, whatever their attributes.
public sealed class Order
{
    public int Id { get; }
    public OrderStatus Status { get; private set; }
    public Money Total { get; }

    public Order(int id, OrderStatus status, Money total)
    {
        Id = id;
        Status = status;
        Total = total;
    }

    public void Cancel() => Status = Status.TransitionTo(OrderStatus.Cancelled);

    public override bool Equals(object? obj) => obj is Order other && Id == other.Id;

    public override int GetHashCode() => Id.GetHashCode();
}
