using LspBefore = RepositoryExample.LiskovSubstitution.Before;
using LspAfter = RepositoryExample.LiskovSubstitution.After;
using Xunit;

namespace RepositoryExample.Tests;

public class LiskovSubstitutionTests
{
    [Fact]
    public void Before_APendingOrderCanBeCancelled()
    {
        var order = new LspBefore.Order { Id = 1 };
        order.Cancel("customer requested");
        Assert.Equal(LspBefore.OrderStatus.Cancelled, order.Status);
    }

    // The precondition GiftOrder accepts is stricter than Order's: Order
    // allows cancelling while pending, GiftOrder never does. That's the LSP
    // violation.
    [Fact]
    public void Before_AGiftOrderRejectsCancellationEvenWhilePending()
    {
        var gift = new LspBefore.GiftOrder { Id = 1 };
        var error = Assert.Throws<InvalidOperationException>(() => gift.Cancel("customer requested"));
        Assert.Equal("gift orders can't be cancelled online", error.Message);
        Assert.Equal(LspBefore.OrderStatus.Pending, gift.Status);
    }

    [Fact]
    public void Before_TheExpiredOrdersBatchMustSkipGiftOrdersToAvoidTheBrokenContract()
    {
        var batch = new LspBefore.CancelExpiredOrders();
        var standard = new LspBefore.Order { Id = 1 };
        var gift = new LspBefore.GiftOrder { Id = 2 };
        var (cancelled, skipped) = batch.Execute([standard, gift], "expired");
        Assert.Equal([1], cancelled);
        Assert.Equal([2], skipped);
        Assert.Equal(LspBefore.OrderStatus.Cancelled, standard.Status);
        Assert.Equal(LspBefore.OrderStatus.Pending, gift.Status);
    }

    [Fact]
    public void Before_TheCustomerServiceToolMustSpecialCaseGiftOrdersToAvoidTheBrokenContract()
    {
        var tool = new LspBefore.CustomerServiceCancelTool();
        var standard = new LspBefore.Order { Id = 1 };
        var gift = new LspBefore.GiftOrder { Id = 2 };
        Assert.Equal("order 1 cancelled: changed my mind", tool.Cancel(standard, "changed my mind"));
        Assert.Equal(LspBefore.OrderStatus.Cancelled, standard.Status);
        Assert.Equal(
            "order 2 must be cancelled by phone: gift orders can't be cancelled online",
            tool.Cancel(gift, "changed my mind"));
        Assert.Equal(LspBefore.OrderStatus.Pending, gift.Status);
    }

    // The same contract body runs against every ICancellableOrder subtype.
    public static IEnumerable<object[]> CancellableFactories()
    {
        yield return new object[] { "standard order", (Func<LspAfter.ICancellableOrder>)(() => new LspAfter.StandardOrder { Id = 1 }) };
        yield return new object[] { "subscription order", (Func<LspAfter.ICancellableOrder>)(() => new LspAfter.SubscriptionOrder { Id = 1 }) };
    }

    [Theory]
    [MemberData(nameof(CancellableFactories))]
    public void After_AnyCancellableOrderCanBeCancelledWhilePending(string name, Func<LspAfter.ICancellableOrder> factory)
    {
        var order = factory();
        order.Cancel("customer requested");
        Assert.True(order.Status == LspAfter.OrderStatus.Cancelled, $"{name}: got {order.Status}");
    }

    [Theory]
    [MemberData(nameof(CancellableFactories))]
    public void After_AnyCancellableOrderRejectsCancellingAnAlreadyCancelledOrder(string name, Func<LspAfter.ICancellableOrder> factory)
    {
        var order = factory();
        order.Cancel("customer requested");
        var error = Assert.Throws<InvalidOperationException>(() => order.Cancel("customer requested"));
        Assert.True(error.Message == "cannot cancel a shipped or cancelled order", name);
    }

    [Fact]
    public void After_TheExpiredOrdersBatchCancelsEveryCancellableOrderWithoutCheckingItsType()
    {
        var batch = new LspAfter.CancelExpiredOrders();
        var standard = new LspAfter.StandardOrder { Id = 1 };
        var subscription = new LspAfter.SubscriptionOrder { Id = 2 };
        var cancelled = batch.Execute([standard, subscription], "expired");
        Assert.Equal([1, 2], cancelled);
        Assert.Equal(LspAfter.OrderStatus.Cancelled, standard.Status);
        Assert.Equal(LspAfter.OrderStatus.Cancelled, subscription.Status);
    }

    [Fact]
    public void After_TheCustomerServiceToolCancelsAnyCancellableOrderWithoutCheckingItsType()
    {
        var tool = new LspAfter.CustomerServiceCancelTool();
        var standard = new LspAfter.StandardOrder { Id = 1 };
        var subscription = new LspAfter.SubscriptionOrder { Id = 2 };
        Assert.Equal("order 1 cancelled: changed my mind", tool.Cancel(standard, "changed my mind"));
        Assert.Equal("order 2 cancelled: changed my mind", tool.Cancel(subscription, "changed my mind"));
    }

    // A gift order shares IOrder's shape but was never given a Cancel
    // method, so it doesn't implement ICancellableOrder — checkable directly
    // at runtime since .NET interfaces exist there, unlike TypeScript's or
    // Python's structural types.
    [Fact]
    public void After_AGiftOrderDoesNotSatisfyTheCancellableOrderContract()
    {
        LspAfter.IOrder gift = new LspAfter.GiftOrder { Id = 1 };
        Assert.False(gift is LspAfter.ICancellableOrder);
        LspAfter.IOrder standard = new LspAfter.StandardOrder { Id = 1 };
        Assert.True(standard is LspAfter.ICancellableOrder);
    }
}
