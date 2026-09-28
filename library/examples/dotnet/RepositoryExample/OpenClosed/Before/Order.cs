namespace RepositoryExample.OpenClosed.Before;

// before: cancellation fees and refund descriptions vary by order type.
public static class OrderType
{
    public const string Standard = "standard";
    public const string Express = "express";
    public const string CustomMade = "custom-made";
    public const string Subscription = "subscription";
}

public static class FeeRates
{
    public const double ExpressFlatFee = 15.0;
    public const double CustomMadeFeeRate = 0.5;
}

public sealed record Order(string Type, double Amount, bool Pending = true, int MonthsElapsed = 0, int TotalMonths = 1);
