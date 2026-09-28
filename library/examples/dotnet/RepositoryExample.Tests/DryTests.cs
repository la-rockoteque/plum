using DryBefore = RepositoryExample.Dry.Before;
using DryAfter = RepositoryExample.Dry.After;
using Xunit;

namespace RepositoryExample.Tests;

public class DryTests
{
    private const long NowMs = 10_000_000;
    private const long WindowMs = 24L * 60 * 60 * 1000;

    private sealed class FixedClock : DryBefore.IClock, DryAfter.IClock
    {
        private readonly long ms;
        public FixedClock(long ms) => this.ms = ms;
        public long NowMs() => ms;
    }

    [Fact]
    public void Before_CliAndApiAgreeAFreshPendingOrderCanBeCancelled()
    {
        var order = new DryBefore.Order(1, DryBefore.OrderStatus.Pending, NowMs);
        var clock = new FixedClock(NowMs);
        Assert.True(new DryBefore.CliCancelHandler().CanCancel(order, clock));
        Assert.True(new DryBefore.ApiCancelHandler().CanCancel(order, clock));
    }

    [Fact]
    public void Before_CliAndApiDisagreeOnceTheCancellationWindowHasPassed()
    {
        var order = new DryBefore.Order(1, DryBefore.OrderStatus.Pending, NowMs - WindowMs * 2);
        var clock = new FixedClock(NowMs);
        Assert.False(new DryBefore.CliCancelHandler().CanCancel(order, clock));
        Assert.True(new DryBefore.ApiCancelHandler().CanCancel(order, clock));
    }

    [Fact]
    public void Before_NeitherHandlerAllowsCancellingAShippedOrder()
    {
        var order = new DryBefore.Order(1, DryBefore.OrderStatus.Shipped, NowMs);
        var clock = new FixedClock(NowMs);
        Assert.False(new DryBefore.CliCancelHandler().CanCancel(order, clock));
        Assert.False(new DryBefore.ApiCancelHandler().CanCancel(order, clock));
    }

    [Fact]
    public void After_CliAndApiAgreeAFreshPendingOrderCanBeCancelled()
    {
        var order = new DryAfter.Order(1, DryAfter.OrderStatus.Pending, NowMs);
        var clock = new FixedClock(NowMs);
        Assert.True(new DryAfter.CliCancelHandler().CanCancel(order, clock));
        Assert.True(new DryAfter.ApiCancelHandler().CanCancel(order, clock));
    }

    [Fact]
    public void After_CliAndApiAgreeOnceTheCancellationWindowHasPassed()
    {
        var order = new DryAfter.Order(1, DryAfter.OrderStatus.Pending, NowMs - WindowMs * 2);
        var clock = new FixedClock(NowMs);
        Assert.False(new DryAfter.CliCancelHandler().CanCancel(order, clock));
        Assert.False(new DryAfter.ApiCancelHandler().CanCancel(order, clock));
    }

    [Fact]
    public void After_NeitherHandlerAllowsCancellingAShippedOrder()
    {
        var order = new DryAfter.Order(1, DryAfter.OrderStatus.Shipped, NowMs);
        var clock = new FixedClock(NowMs);
        Assert.False(new DryAfter.CliCancelHandler().CanCancel(order, clock));
        Assert.False(new DryAfter.ApiCancelHandler().CanCancel(order, clock));
    }
}
