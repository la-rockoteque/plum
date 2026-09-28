namespace RepositoryExample.CouplingCohesion.Before;

// Teaching artifact: the service reaches into the customer's fields to compute a discount.
// When Customer's tier becomes a value type instead of a raw string, OrderService can't
// reuse its existing logic on the new shape - it needs a whole new method just to read it.

public enum LoyaltyTier
{
    Gold,
    Silver,
    Bronze,
}

// The customer's data is public because the service reaches straight into it.
public sealed class Customer
{
    public required string Tier { get; init; }
    public required int LifetimeSpendMinor { get; init; }
    public required int YearsAsMember { get; init; }
}

// Same facts as Customer, after a migration - Tier is now the value type, not a string.
public sealed class MigratedCustomer
{
    public required LoyaltyTier Tier { get; init; }
    public required int LifetimeSpendMinor { get; init; }
    public required int YearsAsMember { get; init; }
}

public sealed class Order
{
    public required int AmountMinor { get; init; }
    public required Customer Customer { get; init; }
}

public sealed class OrderService
{
    public int CancellationFee(Order order)
    {
        // Feature envy: three of the customer's fields, read here instead of asked for.
        var customer = order.Customer;
        int discountBps = customer.Tier == "gold" ? 2000
            : customer.LifetimeSpendMinor >= 100_000 ? 1000
            : customer.YearsAsMember >= 2 ? 500
            : 0;
        return order.AmountMinor * (10_000 - discountBps) / 10_000;
    }

    public int LoyaltyDiscount(Customer customer)
    {
        // The same interpretation, read again for a receipt line.
        if (customer.Tier == "gold") return 2000;
        if (customer.LifetimeSpendMinor >= 100_000) return 1000;
        if (customer.YearsAsMember >= 2) return 500;
        return 0;
    }

    // Exists only because Customer's tier became a value type - OrderService gained a whole
    // new method just to read it, because the interpretation lives here, not on Customer.
    public int MigratedLoyaltyDiscount(MigratedCustomer customer)
    {
        if (customer.Tier == LoyaltyTier.Gold) return 2000;
        if (customer.LifetimeSpendMinor >= 100_000) return 1000;
        if (customer.YearsAsMember >= 2) return 500;
        return 0;
    }
}
