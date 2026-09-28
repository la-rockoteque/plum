namespace RepositoryExample.CharacterizationTests.Refactored;

public class Order
{
    public long OrderId { get; init; }
    public long AmountMinor { get; init; }
    public long PurchasedAtMs { get; init; }
    public string Status { get; init; } = "active";
}

// Same behaviour as Legacy.RefundCalculator.ComputeRefund, including its odd cases - named and
// pinned by the characterization tests rather than "fixed" in passing.
public static class RefundCalculator
{
    private const long MsPerDay = 24 * 60 * 60 * 1000;
    private const int FullRefundWindowDays = 14;
    private const int LateRefundPercent = 90;
    private const int StaleOrderThresholdDays = 30;
    private const long StaleRefundRoundingUnitMinor = 100;

    private static long AgeInDays(Order order, long todayMs) => (todayMs - order.PurchasedAtMs) / MsPerDay;

    private static long BaseRefundMinor(Order order, long ageDays) =>
        ageDays <= FullRefundWindowDays ? order.AmountMinor : (order.AmountMinor * LateRefundPercent) / 100;

    private static long RoundDownIfStale(long refundMinor, long ageDays) =>
        ageDays > StaleOrderThresholdDays
            ? (refundMinor / StaleRefundRoundingUnitMinor) * StaleRefundRoundingUnitMinor
            : refundMinor;

    public static long ComputeRefund(Order order, long todayMs)
    {
        if (order.Status == "hold") return 0;
        var ageDays = AgeInDays(order, todayMs);
        var refund = BaseRefundMinor(order, ageDays);
        return RoundDownIfStale(refund, ageDays);
    }
}
