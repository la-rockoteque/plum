namespace RepositoryExample.LawOfDemeter.After;

// Each object only talks to its own data or its direct collaborator; the caller asks Order one
// question at a time. A pickup point's missing country is absorbed where it lives, in Address,
// instead of blowing up three hops away.

public sealed class Country
{
    public required string Code { get; init; }
}

public sealed class Address
{
    public Country? Country { get; init; } // null for a pickup point

    public bool IsDomestic() => Country is not null && Country.Code == "US";
}

public sealed class Card
{
    public required bool Expired { get; init; }

    public bool IsExpired() => Expired;
}

public sealed class Wallet
{
    public required Card Card { get; init; }

    public bool HasValidCard() => !Card.IsExpired();
}

public sealed class Customer
{
    public required Address Address { get; init; }
    public required Wallet Wallet { get; init; }

    public bool ShipsDomestically() => Address.IsDomestic();

    public bool CanAutoRefund() => Wallet.HasValidCard();
}

public sealed class Order
{
    public required Customer Customer { get; init; }

    public bool ReturnsShipDomestically() => Customer.ShipsDomestically();

    public bool CanAutoRefund() => Customer.CanAutoRefund();
}

public sealed class CancellationPolicy
{
    public bool ShipsDomestically(Order order) => order.ReturnsShipDomestically();

    public bool CanAutoRefund(Order order) => order.CanAutoRefund();
}
