namespace RepositoryExample.OpenClosed.After;

// One policy per order type: each owns both its fee and its refund
// description, so the two concerns can never fall out of sync again.
public interface IFeePolicy
{
    double Fee(Order order);
    string DescribeRefund(Order order);
}

public static class FeeRates
{
    public const double ExpressFlatFee = 15.0;
    public const double CustomMadeFeeRate = 0.5;
}

public sealed class StandardFeePolicy : IFeePolicy
{
    public double Fee(Order order) => order.Pending ? 0.0 : order.Amount;

    public string DescribeRefund(Order order) =>
        order.Pending ? "Full refund, order not yet processed" : "No refund, order already shipped";
}

public sealed class ExpressFeePolicy : IFeePolicy
{
    public double Fee(Order order) => FeeRates.ExpressFlatFee;

    public string DescribeRefund(Order order) => "Refund minus a flat express handling fee";
}

public sealed class CustomMadeFeePolicy : IFeePolicy
{
    public double Fee(Order order) => order.Amount * FeeRates.CustomMadeFeeRate;

    public string DescribeRefund(Order order) => "50% refund, materials already committed";
}

public sealed class SubscriptionFeePolicy : IFeePolicy
{
    public double Fee(Order order) => order.Amount * order.MonthsElapsed / order.TotalMonths;

    public string DescribeRefund(Order order) => "Prorated refund for unused months";
}

public static class DefaultPolicies
{
    public static Dictionary<string, IFeePolicy> Create() => new()
    {
        [OrderType.Standard] = new StandardFeePolicy(),
        [OrderType.Express] = new ExpressFeePolicy(),
        [OrderType.CustomMade] = new CustomMadeFeePolicy(),
        [OrderType.Subscription] = new SubscriptionFeePolicy(),
    };
}
