namespace RepositoryExample.LawOfDemeter.After;

// Each object only talks to its own data or its direct collaborator. Address answers
// "domestic?" for itself whether it still holds a plain country or, after the region
// migration, a Region one hop further out -- so the callers below never learn the new shape.

public sealed class Country
{
    public required string Code { get; init; }
}

public sealed class Region
{
    public required Country Country { get; init; }

    public bool IsDomestic() => Country.Code == "US";
}

public sealed class Address
{
    public Country? Country { get; init; }
    public Region? Region { get; init; }

    public bool IsDomestic()
    {
        if (Region is not null)
        {
            return Region.IsDomestic();
        }
        if (Country is not null)
        {
            return Country.Code == "US";
        }
        return false; // a pickup point has no single country either
    }
}

public sealed class Customer
{
    public required Address Address { get; init; }

    public bool CanAutoRefund() => Address.IsDomestic();

    public bool NeedsCustomsForm() => !Address.IsDomestic();
}

public sealed class Order
{
    public required Customer Customer { get; init; }

    public bool CanAutoRefund() => Customer.CanAutoRefund();

    public bool NeedsCustomsForm() => Customer.NeedsCustomsForm();
}

public sealed class CancellationPolicy
{
    public bool CanAutoRefund(Order order) => order.CanAutoRefund();
}

public sealed class ReturnLabelPrinter
{
    public bool NeedsCustomsForm(Order order) => order.NeedsCustomsForm();
}
