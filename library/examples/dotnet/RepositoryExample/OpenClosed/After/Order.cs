namespace RepositoryExample.OpenClosed.After;

// after: cancellation fees and refund descriptions vary by order type.
public static class OrderType
{
    public const string Standard = "standard";
    public const string Express = "express";
    public const string CustomMade = "custom-made";
    public const string Subscription = "subscription";
}

public sealed record Order(string Type, double Amount, bool Pending = true, int MonthsElapsed = 0, int TotalMonths = 1);
