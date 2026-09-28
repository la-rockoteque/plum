namespace RepositoryExample.LawOfDemeter.Before;

// Teaching artifact: the refund and customs decisions each walk straight through the
// customer's address to read its country -- a train wreck that breaks not by crashing, but by
// silently giving the wrong answer the day the country moves one hop further out.

public sealed class Country
{
    public required string Code { get; init; }
}

// Introduced later: countries are grouped under a customs region.
public sealed class Region
{
    public required Country Country { get; init; }
}

public sealed class Address
{
    // Exactly one of these is set: Country for an address created before the region
    // migration, Region for one created after it. Neither caller below knows about Region.
    public Country? Country { get; init; }
    public Region? Region { get; init; }
}

public sealed class Customer
{
    public required Address Address { get; init; }
}

public sealed class Order
{
    public required Customer Customer { get; init; }
}

public sealed class CancellationPolicy
{
    public bool CanAutoRefund(Order order)
    {
        // Train wreck: order -> Customer -> Address -> Country -> Code.
        var address = order.Customer.Address;
        if (address.Country is null)
        {
            return false; // play it safe: no auto-refund if we can't read a country
        }
        return address.Country.Code == "US";
    }
}

public sealed class ReturnLabelPrinter
{
    public bool NeedsCustomsForm(Order order)
    {
        // Train wreck: order -> Customer -> Address -> Country -> Code.
        var address = order.Customer.Address;
        if (address.Country is null)
        {
            return true; // play it safe: assume a customs form is needed
        }
        return address.Country.Code != "US";
    }
}
