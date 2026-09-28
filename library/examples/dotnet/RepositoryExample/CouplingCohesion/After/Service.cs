namespace RepositoryExample.CouplingCohesion.After;

// The customer owns the question "what discount do I get?"; the service only asks it.

public sealed class Customer
{
    public required string Tier { get; init; }
    public required double LifetimeSpend { get; init; }
    public required int YearsAsMember { get; init; }

    // The one place that knows how tier, spend and membership translate into a discount.
    public double CancellationDiscount()
    {
        if (Tier == "gold") return 0.25;
        if (LifetimeSpend >= 1000) return 0.125;
        if (YearsAsMember >= 2) return 0.0625;
        return 0;
    }
}

public sealed class Order
{
    public required double Amount { get; init; }
    public required Customer Customer { get; init; }
}

public sealed class OrderService
{
    public double CancellationFee(Order order) =>
        order.Amount * (1 - order.Customer.CancellationDiscount());

    public double LoyaltyDiscount(Customer customer) => customer.CancellationDiscount();
}
