using GreenOrder = RepositoryExample.RedGreenRefactor.Green.Order;
using RedOrder = RepositoryExample.RedGreenRefactor.Red.Order;
using RefactorOrder = RepositoryExample.RedGreenRefactor.Refactor.Order;
using RefactorOrderStatus = RepositoryExample.RedGreenRefactor.Refactor.OrderStatus;
using Xunit;

namespace RepositoryExample.Tests;

public class RedGreenRefactorTests
{
    [Fact]
    public void Red_CancellingAShippedOrderIsStillAllowed()
    {
        // The new rule doesn't exist yet: this passing test pins the flaw it will fix.
        var order = new RedOrder("shipped");
        order.Cancel();
        Assert.Equal("cancelled", order.Status);
    }

    [Fact]
    public void Green_CancellingAPendingOrderSucceeds()
    {
        var order = new GreenOrder("pending");
        order.Cancel();
        Assert.Equal("cancelled", order.Status);
    }

    [Fact]
    public void Green_CancellingAShippedOrderIsRejected()
    {
        var order = new GreenOrder("shipped");
        Assert.Throws<InvalidOperationException>(order.Cancel);
        Assert.Equal("shipped", order.Status);
    }

    [Fact]
    public void Refactor_CancellingAPendingOrderSucceeds()
    {
        // Same case as Green, run against the refactored design.
        var order = new RefactorOrder(RefactorOrderStatus.Pending);
        order.Cancel();
        Assert.Equal(RefactorOrderStatus.Cancelled, order.Status);
    }

    [Fact]
    public void Refactor_CancellingAShippedOrderIsRejected()
    {
        // Same case as Green, run against the refactored design.
        var order = new RefactorOrder(RefactorOrderStatus.Shipped);
        Assert.Throws<InvalidOperationException>(order.Cancel);
        Assert.Equal(RefactorOrderStatus.Shipped, order.Status);
    }
}
