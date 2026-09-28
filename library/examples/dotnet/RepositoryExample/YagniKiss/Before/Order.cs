namespace RepositoryExample.YagniKiss.Before;

// before: a pluggable CancellationPolicy registry, hooks and a config flag — for one policy that exists.
public enum OrderStatus { Pending, Shipped, Cancelled }

public interface IClock
{
    long NowMs();
}

public sealed record Order(int Id, OrderStatus Status, long PlacedAtMs);

public interface ICancellationPolicy
{
    bool CanCancel(Order order, IClock clock);
}

// The only policy that has ever existed.
public sealed class StandardCancellationPolicy : ICancellationPolicy
{
    public const long WindowMs = 24L * 60 * 60 * 1000;

    public bool CanCancel(Order order, IClock clock)
    {
        if (order.Status != OrderStatus.Pending) return false;
        return clock.NowMs() - order.PlacedAtMs <= WindowMs;
    }
}

// Extension points nobody has ever wired up.
public sealed class CancellationHooks
{
    public List<Action<Order>> OnBeforeCancel { get; } = new();
    public List<Action<Order>> OnAfterCancel { get; } = new();
}

// A pluggable seam for a second policy that has never shown up.
public sealed class CancellationPolicyRegistry
{
    public const string DefaultPolicyName = "standard";

    private readonly Dictionary<string, ICancellationPolicy> policies = new()
    {
        [DefaultPolicyName] = new StandardCancellationPolicy(),
    };

    public void Register(string name, ICancellationPolicy policy) => policies[name] = policy;

    // A typo in `name` is silently swallowed: it just falls back to the default.
    public ICancellationPolicy Resolve(string name) =>
        policies.TryGetValue(name, out var policy) ? policy : policies[DefaultPolicyName];
}

public sealed class OrderCancellationService
{
    public CancellationHooks Hooks { get; }
    public bool StrictMode { get; } // dead: nothing reads this flag
    private readonly ICancellationPolicy policy;

    public OrderCancellationService(
        string policyName = CancellationPolicyRegistry.DefaultPolicyName,
        CancellationHooks? hooks = null,
        bool strictMode = false,
        CancellationPolicyRegistry? registry = null)
    {
        Hooks = hooks ?? new CancellationHooks();
        StrictMode = strictMode;
        policy = (registry ?? new CancellationPolicyRegistry()).Resolve(policyName);
    }

    public bool CanCancel(Order order, IClock clock)
    {
        foreach (var hook in Hooks.OnBeforeCancel) hook(order);
        var result = policy.CanCancel(order, clock);
        foreach (var hook in Hooks.OnAfterCancel) hook(order);
        return result;
    }
}
