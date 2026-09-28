namespace RepositoryExample.CouplingCohesion.Before;

// Teaching artifact: the service reaches into the customer's fields to compute a discount,
// and the rule gets duplicated (and drifts) because nothing owns it but the service.

// The customer's data is public because the service reaches straight into it.
public sealed class Customer
{
    public required string Tier { get; init; }
    public required double LifetimeSpend { get; init; }
    public required int YearsAsMember { get; init; }
}

public sealed class Order
{
    public required double Amount { get; init; }
    public required Customer Customer { get; init; }
}

public sealed class OrderService
{
    public double CancellationFee(Order order)
    {
        // Feature envy: three of the customer's fields, read here instead of asked for.
        var customer = order.Customer;
        double discount = customer.Tier == "gold" ? 0.25
            : customer.LifetimeSpend >= 1000 ? 0.125
            : customer.YearsAsMember >= 2 ? 0.0625
            : 0;
        return order.Amount * (1 - discount);
    }

    public double LoyaltyDiscount(Customer customer)
    {
        // The same rule, copied for a receipt line — and it has drifted (`>` vs `>=`).
        if (customer.Tier == "gold") return 0.25;
        if (customer.LifetimeSpend > 1000) return 0.125;
        if (customer.YearsAsMember >= 2) return 0.0625;
        return 0;
    }
}
