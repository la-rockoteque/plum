namespace RepositoryExample.ValueObjectsEntities.Before;

// An order built from bare primitives: Status and Total carry no rules of their own. It's a
// record (compares all fields by value) so the "compares unequal to itself" flaw below is visible
// without writing a comparer by hand — the same trap a hand-rolled value-based Equals would fall into.
public sealed record Order
{
    public int Id { get; set; }
    public string Status { get; set; } = "pending";
    public double Total { get; set; }
    public string Currency { get; set; } = "USD";
}

public static class Totals
{
    // Adds two orders' totals. Nothing here notices the currencies might differ.
    public static double AddTotals(Order a, Order b) => a.Total + b.Total;
}
