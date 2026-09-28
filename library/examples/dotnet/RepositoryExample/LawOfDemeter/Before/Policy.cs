namespace RepositoryExample.LawOfDemeter.Before;

// Teaching artifact: cancelling an order walks straight through the customer's address and
// wallet to decide how to ship the return and whether to auto-refund — a train wreck that
// breaks the moment one address turns out not to have a country.

public sealed class Country
{
    public required string Code { get; init; }
}

public sealed class Address
{
    // Null for a pickup point — no single country's customs apply.
    public Country? Country { get; init; }
}

public sealed class Card
{
    public required bool Expired { get; init; }
}

public sealed class Wallet
{
    public required Card Card { get; init; }
}

public sealed class Customer
{
    public required Address Address { get; init; }
    public required Wallet Wallet { get; init; }
}

public sealed class Order
{
    public required Customer Customer { get; init; }
}

public sealed class CancellationPolicy
{
    public bool ShipsDomestically(Order order) =>
        // Train wreck: order -> Customer -> Address -> Country -> Code.
        order.Customer.Address.Country!.Code == "US";

    public bool CanAutoRefund(Order order) =>
        // Train wreck: order -> Customer -> Wallet -> Card -> Expired.
        !order.Customer.Wallet.Card.Expired;
}
