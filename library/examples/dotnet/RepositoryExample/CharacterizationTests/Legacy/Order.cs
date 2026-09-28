namespace RepositoryExample.CharacterizationTests.Legacy;

public class Order
{
    public long OrderId { get; init; }
    public long AmountMinor { get; init; }
    public long PurchasedAtMs { get; init; }
    public string Status { get; init; } = "active";
}

// Nobody who still works here wrote this. It has never had a test.
public static class RefundCalculator
{
    public static long ComputeRefund(Order order, long todayMs)
    {
        if (order.Status == "hold")
        {
            return 0;
        }
        else
        {
            var ageDays = (todayMs - order.PurchasedAtMs) / 86400000;
            long refund;
            if (ageDays <= 14)
            {
                refund = order.AmountMinor;
            }
            else
            {
                refund = (order.AmountMinor * 90) / 100;
            }
            if (ageDays > 30)
            {
                return (refund / 100) * 100;
            }
            else
            {
                return refund;
            }
        }
    }
}
