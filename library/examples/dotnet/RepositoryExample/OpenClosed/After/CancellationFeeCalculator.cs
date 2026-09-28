namespace RepositoryExample.OpenClosed.After;

// Chooses the policy once, by order type; a new type means adding to the map
// passed in here, never a new branch in this class.
public sealed class CancellationFeeCalculator(Dictionary<string, IFeePolicy>? policies = null)
{
    private readonly Dictionary<string, IFeePolicy> _policies = policies ?? DefaultPolicies.Create();

    public double CalculateFee(Order order) => _policies[order.Type].Fee(order);

    public string DescribeRefund(Order order) => _policies[order.Type].DescribeRefund(order);
}
