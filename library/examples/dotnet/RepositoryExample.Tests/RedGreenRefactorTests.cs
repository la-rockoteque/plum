using GreenOrder = RepositoryExample.RedGreenRefactor.Green.Order;
using RedOrder = RepositoryExample.RedGreenRefactor.Red.Order;
using RefactorOrder = RepositoryExample.RedGreenRefactor.Refactor.Order;
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

    // One shared test body runs against both stages: green and refactor must behave identically.
    public static IEnumerable<object[]> GreenAndRefactorFactories()
    {
        yield return new object[]
        {
            "green",
            (Func<string, (Action Cancel, Func<string> Status)>)(status =>
            {
                var order = new GreenOrder(status);
                return (order.Cancel, () => order.Status);
            }),
        };
        yield return new object[]
        {
            "refactor",
            (Func<string, (Action Cancel, Func<string> Status)>)(status =>
            {
                var order = new RefactorOrder(status);
                return (order.Cancel, () => order.Status);
            }),
        };
    }

    [Theory]
    [MemberData(nameof(GreenAndRefactorFactories))]
    public void CancellingAPendingOrderSucceeds(string stage, Func<string, (Action Cancel, Func<string> Status)> build)
    {
        var (cancel, status) = build("pending");
        cancel();
        Assert.True(status() == "cancelled", $"{stage}: got status {status()}, want cancelled");
    }

    [Theory]
    [MemberData(nameof(GreenAndRefactorFactories))]
    public void CancellingAShippedOrderIsRejected(string stage, Func<string, (Action Cancel, Func<string> Status)> build)
    {
        var (cancel, status) = build("shipped");
        Assert.Throws<InvalidOperationException>(cancel);
        Assert.True(status() == "shipped", $"{stage}: got status {status()}, want shipped");
    }
}
