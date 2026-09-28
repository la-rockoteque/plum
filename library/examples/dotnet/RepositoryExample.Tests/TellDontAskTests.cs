using Xunit;
using TellDontAskBefore = RepositoryExample.TellDontAsk.Before;
using TellDontAskAfter = RepositoryExample.TellDontAsk.After;

namespace RepositoryExample.Tests;

public class TellDontAskTests
{
    private sealed class FixedClock : TellDontAskBefore.IClock, TellDontAskAfter.IClock
    {
        private readonly long ms;
        public FixedClock(long ms) => this.ms = ms;
        public long NowMs() => ms;
    }

    [Fact]
    public void Before_ApiHandlerCancelsAPendingOrderAndSetsTheRefund()
    {
        var order = new TellDontAskBefore.Order
        {
            Id = 1,
            Status = TellDontAskBefore.OrderStatus.Pending,
            AmountPaidCents = 5000,
        };
        new TellDontAskBefore.ApiCancelHandler().Cancel(order, new FixedClock(1000));
        Assert.Equal(TellDontAskBefore.OrderStatus.Cancelled, order.Status);
        Assert.Equal(1000, order.CancelledAtMs);
        Assert.Equal(5000, order.RefundDueCents);
    }

    [Fact]
    public void Before_NightlyJobCancelsAStaleOrderButLeavesTheRefundUnset()
    {
        var order = new TellDontAskBefore.Order
        {
            Id = 2,
            Status = TellDontAskBefore.OrderStatus.Pending,
            AmountPaidCents = 5000,
        };
        new TellDontAskBefore.NightlyCancelJob().Cancel(order, new FixedClock(1000));
        Assert.Equal(TellDontAskBefore.OrderStatus.Cancelled, order.Status);
        Assert.Equal(0, order.RefundDueCents); // bug: the payment is gone, no refund recorded
    }

    [Fact]
    public void Before_AdminToolCancelsAnAlreadyShippedOrder()
    {
        var order = new TellDontAskBefore.Order
        {
            Id = 3,
            Status = TellDontAskBefore.OrderStatus.Shipped,
            AmountPaidCents = 5000,
            ShippedAtMs = 500,
        };
        new TellDontAskBefore.AdminCancelTool().Cancel(order, new FixedClock(1000));
        Assert.Equal(TellDontAskBefore.OrderStatus.Cancelled, order.Status); // bug: should stay shipped
    }

    [Fact]
    public void After_ApiHandlerNightlyJobAndAdminToolAllCancelTheSameWay()
    {
        var clock = new FixedClock(1000);

        var apiOrder = new TellDontAskAfter.Order(1, TellDontAskAfter.OrderStatus.Pending, 5000);
        new TellDontAskAfter.ApiCancelHandler().Cancel(apiOrder, clock);

        var nightlyOrder = new TellDontAskAfter.Order(2, TellDontAskAfter.OrderStatus.Pending, 5000);
        new TellDontAskAfter.NightlyCancelJob().Cancel(nightlyOrder, clock);

        var adminOrder = new TellDontAskAfter.Order(3, TellDontAskAfter.OrderStatus.Pending, 5000);
        new TellDontAskAfter.AdminCancelTool().Cancel(adminOrder, clock);

        foreach (var order in new[] { apiOrder, nightlyOrder, adminOrder })
        {
            Assert.Equal(TellDontAskAfter.OrderStatus.Cancelled, order.Status);
            Assert.Equal(1000, order.CancelledAtMs);
            Assert.Equal(5000, order.RefundDueCents);
        }
    }

    [Fact]
    public void After_CancellingAnAlreadyShippedOrderIsRejected()
    {
        var clock = new FixedClock(1000);

        void AssertRejected(Action<TellDontAskAfter.Order, TellDontAskAfter.IClock> cancel)
        {
            var order = new TellDontAskAfter.Order(4, TellDontAskAfter.OrderStatus.Shipped, 5000, 500);
            Assert.Throws<InvalidOperationException>(() => cancel(order, clock));
            Assert.Equal(TellDontAskAfter.OrderStatus.Shipped, order.Status);
            Assert.Null(order.CancelledAtMs);
            Assert.Equal(0, order.RefundDueCents);
        }

        AssertRejected((order, c) => new TellDontAskAfter.ApiCancelHandler().Cancel(order, c));
        AssertRejected((order, c) => new TellDontAskAfter.NightlyCancelJob().Cancel(order, c));
        AssertRejected((order, c) => new TellDontAskAfter.AdminCancelTool().Cancel(order, c));
    }
}
