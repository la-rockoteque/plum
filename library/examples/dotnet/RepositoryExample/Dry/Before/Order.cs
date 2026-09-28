namespace RepositoryExample.Dry.Before;

// before: the cancellation-eligibility rule is copy-pasted into a CLI and an API handler.
public enum OrderStatus { Pending, Shipped, Cancelled }

public interface IClock
{
    long NowMs();
}

public sealed record Order(int Id, OrderStatus Status, long PlacedAtMs);

public static class CancellationRule
{
    public const long WindowMs = 24L * 60 * 60 * 1000;
}

// Got the window check in a later bug fix.
public sealed class CliCancelHandler
{
    public bool CanCancel(Order order, IClock clock)
    {
        if (order.Status != OrderStatus.Pending) return false;
        return clock.NowMs() - order.PlacedAtMs <= CancellationRule.WindowMs;
    }
}

// Copy-pasted from the CLI handler before the window check was added.
public sealed class ApiCancelHandler
{
    public bool CanCancel(Order order, IClock clock) => order.Status == OrderStatus.Pending;
}
