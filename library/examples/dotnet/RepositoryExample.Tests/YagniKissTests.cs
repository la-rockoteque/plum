using YagniKissBefore = RepositoryExample.YagniKiss.Before;
using YagniKissAfter = RepositoryExample.YagniKiss.After;
using Xunit;

namespace RepositoryExample.Tests;

public class YagniKissTests
{
    private const long NowMs = 10_000_000;
    private const long WindowMs = 24L * 60 * 60 * 1000;

    private sealed class FixedClock : YagniKissBefore.IClock, YagniKissAfter.IClock
    {
        private readonly long ms;
        public FixedClock(long ms) => this.ms = ms;
        public long NowMs() => ms;
    }

    [Fact]
    public void Before_AFreshPendingOrderCanBeCancelled()
    {
        var order = new YagniKissBefore.Order(1, YagniKissBefore.OrderStatus.Pending, NowMs);
        var clock = new FixedClock(NowMs);
        var service = new YagniKissBefore.OrderCancellationService();
        Assert.True(service.CanCancel(order, clock));
    }

    [Fact]
    public void Before_AnOrderPastTheCancellationWindowCannotBeCancelled()
    {
        var order = new YagniKissBefore.Order(1, YagniKissBefore.OrderStatus.Pending, NowMs - WindowMs * 2);
        var clock = new FixedClock(NowMs);
        var service = new YagniKissBefore.OrderCancellationService();
        Assert.False(service.CanCancel(order, clock));
    }

    [Fact]
    public void Before_AShippedOrderCannotBeCancelled()
    {
        var order = new YagniKissBefore.Order(1, YagniKissBefore.OrderStatus.Shipped, NowMs);
        var clock = new FixedClock(NowMs);
        var service = new YagniKissBefore.OrderCancellationService();
        Assert.False(service.CanCancel(order, clock));
    }

    [Fact]
    public void Before_ATypoInThePolicyConfigNameSilentlyFallsBackToTheDefaultPolicy()
    {
        var order = new YagniKissBefore.Order(1, YagniKissBefore.OrderStatus.Pending, NowMs);
        var clock = new FixedClock(NowMs);
        var correctlyNamed = new YagniKissBefore.OrderCancellationService("standard");
        var typoNamed = new YagniKissBefore.OrderCancellationService("stadnard");
        Assert.Equal(correctlyNamed.CanCancel(order, clock), typoNamed.CanCancel(order, clock));
    }

    [Fact]
    public void Before_TheUnusedCancellationHooksAreNeverInvoked()
    {
        var service = new YagniKissBefore.OrderCancellationService();
        Assert.Empty(service.Hooks.OnBeforeCancel);
        Assert.Empty(service.Hooks.OnAfterCancel);
    }

    [Fact]
    public void After_AFreshPendingOrderCanBeCancelled()
    {
        var order = new YagniKissAfter.Order(1, YagniKissAfter.OrderStatus.Pending, NowMs);
        var clock = new FixedClock(NowMs);
        Assert.True(order.CanBeCancelled(clock));
    }

    [Fact]
    public void After_AnOrderPastTheCancellationWindowCannotBeCancelled()
    {
        var order = new YagniKissAfter.Order(1, YagniKissAfter.OrderStatus.Pending, NowMs - WindowMs * 2);
        var clock = new FixedClock(NowMs);
        Assert.False(order.CanBeCancelled(clock));
    }

    [Fact]
    public void After_AShippedOrderCannotBeCancelled()
    {
        var order = new YagniKissAfter.Order(1, YagniKissAfter.OrderStatus.Shipped, NowMs);
        var clock = new FixedClock(NowMs);
        Assert.False(order.CanBeCancelled(clock));
    }
}
