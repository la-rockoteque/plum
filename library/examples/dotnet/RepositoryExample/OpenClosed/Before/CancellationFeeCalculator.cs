namespace RepositoryExample.OpenClosed.Before;

// One switch on order.Type decides the fee — and it isn't the only one
// (see RefundDescription.cs).
public sealed class CancellationFeeCalculator
{
    public double CalculateFee(Order order) => order.Type switch
    {
        OrderType.Standard => order.Pending ? 0.0 : order.Amount,
        OrderType.Express => FeeRates.ExpressFlatFee,
        OrderType.CustomMade => order.Amount * FeeRates.CustomMadeFeeRate,
        OrderType.Subscription => order.Amount * order.MonthsElapsed / order.TotalMonths,
        _ => throw new InvalidOperationException($"unhandled order type: {order.Type}"),
    };
}
