using AggregatesBefore = RepositoryExample.Aggregates.Before;
using AggregatesAfter = RepositoryExample.Aggregates.After;
using Xunit;

namespace RepositoryExample.Tests;

public class AggregatesTests
{
    [Fact]
    public void Before_AddingALineDoesNotUpdateTheCachedTotal()
    {
        var order = new AggregatesBefore.Order { Id = 1 };
        var repo = new AggregatesBefore.OrderLineRepository();
        repo.Add(new AggregatesBefore.OrderLine { Id = 1, OrderId = 1, Sku = "WIDGET", Quantity = 2, UnitPriceMinor = 500, Currency = "USD" });
        Assert.Equal(0, order.TotalMinor);
    }

    [Fact]
    public void Before_AnEleventhLineIsAccepted()
    {
        var repo = new AggregatesBefore.OrderLineRepository();
        for (var i = 0; i < 11; i++)
        {
            repo.Add(new AggregatesBefore.OrderLine { Id = i, OrderId = 1, Sku = "SKU", Quantity = 1, UnitPriceMinor = 100, Currency = "USD" });
        }
        Assert.Equal(11, repo.ForOrder(1).Count);
    }

    [Fact]
    public void Before_ALinesQuantityCanBeSetToZero()
    {
        var repo = new AggregatesBefore.OrderLineRepository();
        repo.Add(new AggregatesBefore.OrderLine { Id = 1, OrderId = 1, Sku = "WIDGET", Quantity = 2, UnitPriceMinor = 500, Currency = "USD" });
        repo.UpdateQuantity(1, 0);
        Assert.Equal(0, repo.ForOrder(1)[0].Quantity);
    }

    [Fact]
    public void Before_ACancelledOrdersLineCanStillBeChanged()
    {
        var order = new AggregatesBefore.Order { Id = 1, Status = "cancelled" };
        var repo = new AggregatesBefore.OrderLineRepository();
        repo.Add(new AggregatesBefore.OrderLine { Id = 1, OrderId = 1, Sku = "WIDGET", Quantity = 2, UnitPriceMinor = 500, Currency = "USD" });
        repo.UpdateQuantity(1, 5);
        Assert.Equal("cancelled", order.Status);
        Assert.Equal(5, repo.ForOrder(1)[0].Quantity);
    }

    [Fact]
    public void Before_ALineFetchedFromTheRepositoryCanBeMutatedDirectly()
    {
        var repo = new AggregatesBefore.OrderLineRepository();
        repo.Add(new AggregatesBefore.OrderLine { Id = 1, OrderId = 1, Sku = "WIDGET", Quantity = 2, UnitPriceMinor = 500, Currency = "USD" });
        var fetched = repo.ForOrder(1)[0];
        fetched.Quantity = 99;
        Assert.Equal(99, repo.ForOrder(1)[0].Quantity);
    }

    [Fact]
    public void Before_RecomputeTotalMustBeCalledManuallyToStayCorrect()
    {
        var order = new AggregatesBefore.Order { Id = 1 };
        var repo = new AggregatesBefore.OrderLineRepository();
        repo.Add(new AggregatesBefore.OrderLine { Id = 1, OrderId = 1, Sku = "WIDGET", Quantity = 2, UnitPriceMinor = 500, Currency = "USD" });
        AggregatesBefore.Totals.RecomputeTotal(order, repo.ForOrder(1));
        Assert.Equal(1000, order.TotalMinor);
        repo.UpdateQuantity(1, 5);
        Assert.Equal(1000, order.TotalMinor);
    }

    [Fact]
    public void After_AddingALineUpdatesTheTotalImmediately()
    {
        var order = new AggregatesAfter.Order(1);
        order.AddLine("WIDGET", 2, 500, "USD");
        Assert.Equal(1000, order.TotalMinor);
    }

    [Fact]
    public void After_AnEleventhLineIsRejected()
    {
        var order = new AggregatesAfter.Order(1);
        for (var i = 0; i < 10; i++)
        {
            order.AddLine("SKU", 1, 100, "USD");
        }
        Assert.Throws<AggregatesAfter.TooManyLinesException>(() => order.AddLine("SKU", 1, 100, "USD"));
    }

    [Fact]
    public void After_ChangingALinesQuantityToZeroIsRejected()
    {
        var order = new AggregatesAfter.Order(1);
        var lineId = order.AddLine("WIDGET", 2, 500, "USD");
        Assert.Throws<AggregatesAfter.InvalidQuantityException>(() => order.ChangeQuantity(lineId, 0));
    }

    [Fact]
    public void After_ChangingALineOnACancelledOrderIsRejected()
    {
        var order = new AggregatesAfter.Order(1);
        var lineId = order.AddLine("WIDGET", 2, 500, "USD");
        order.Cancel();
        Assert.Throws<AggregatesAfter.OrderCancelledException>(() => order.ChangeQuantity(lineId, 3));
    }

    [Fact]
    public void After_CancellingAShippedOrAlreadyCancelledOrderIsRejected()
    {
        var shipped = new AggregatesAfter.Order(1, status: AggregatesAfter.OrderStatus.Shipped);
        Assert.Throws<AggregatesAfter.OrderCancelledException>(() => shipped.Cancel());

        var cancelled = new AggregatesAfter.Order(2, status: AggregatesAfter.OrderStatus.Cancelled);
        Assert.Throws<AggregatesAfter.OrderCancelledException>(() => cancelled.Cancel());
    }

    [Fact]
    public void After_AddingALineInAnotherCurrencyIsRejected()
    {
        var order = new AggregatesAfter.Order(1, currency: "USD");
        Assert.Throws<AggregatesAfter.CurrencyMismatchException>(() => order.AddLine("WIDGET", 1, 500, "EUR"));
    }

    [Fact]
    public void After_TheLinesReturnedByTheOrderAreCopiesThatCannotMutateIt()
    {
        var order = new AggregatesAfter.Order(1);
        order.AddLine("WIDGET", 2, 500, "USD");
        var fetched = order.Lines[0];
        fetched.Quantity = 99;
        Assert.Equal(2, order.Lines[0].Quantity);
        Assert.Equal(1000, order.TotalMinor);
    }

    [Fact]
    public void After_TheRepositorySavesAndLoadsTheWholeOrder()
    {
        var order = new AggregatesAfter.Order(1);
        order.AddLine("WIDGET", 2, 500, "USD");
        var repo = new AggregatesAfter.OrderRepository();
        repo.Save(order);

        // Mutating the original after save must not reach the stored copy.
        order.AddLine("GADGET", 1, 250, "USD");

        var loaded = repo.Get(1);
        Assert.NotNull(loaded);
        Assert.Equal(1000, loaded!.TotalMinor);
        Assert.Single(loaded.Lines);

        // Mutating the loaded copy must not reach the stored order either.
        loaded.AddLine("MUTATED", 1, 1, "USD");
        var again = repo.Get(1);
        Assert.Equal(1000, again!.TotalMinor);
    }
}
