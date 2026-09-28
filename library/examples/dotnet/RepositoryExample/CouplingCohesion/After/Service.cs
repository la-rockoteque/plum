namespace RepositoryExample.CouplingCohesion.After;

// Customer answers its own question - what loyalty discount do I get? OrderService only
// asks, through an interface, so it never cares which representation of Customer answers.

public enum LoyaltyTier
{
    Gold,
    Silver,
    Bronze,
}

// Satisfied by any Customer representation that can answer its own loyalty discount.
public interface IDiscountEligible
{
    int LoyaltyDiscount();
}

public sealed class Customer : IDiscountEligible
{
    public required string Tier { get; init; }
    public required int LifetimeSpendMinor { get; init; }
    public required int YearsAsMember { get; init; }

    // The one place that knows how tier, spend and membership translate into a discount.
    public int LoyaltyDiscount()
    {
        if (Tier == "gold") return 2000;
        if (LifetimeSpendMinor >= 100_000) return 1000;
        if (YearsAsMember >= 2) return 500;
        return 0;
    }
}

// Asks the same question with a different internal shape - Tier is the value type, not a
// string.
public sealed class MigratedCustomer : IDiscountEligible
{
    public required LoyaltyTier Tier { get; init; }
    public required int LifetimeSpendMinor { get; init; }
    public required int YearsAsMember { get; init; }

    public int LoyaltyDiscount()
    {
        if (Tier == LoyaltyTier.Gold) return 2000;
        if (LifetimeSpendMinor >= 100_000) return 1000;
        if (YearsAsMember >= 2) return 500;
        return 0;
    }
}

public sealed class Order
{
    public required int AmountMinor { get; init; }
    public required IDiscountEligible Customer { get; init; }
}

public sealed class OrderService
{
    public int CancellationFee(Order order)
    {
        var discountBps = order.Customer.LoyaltyDiscount();
        return order.AmountMinor * (10_000 - discountBps) / 10_000;
    }

    public int LoyaltyDiscount(IDiscountEligible customer) => customer.LoyaltyDiscount();
}
