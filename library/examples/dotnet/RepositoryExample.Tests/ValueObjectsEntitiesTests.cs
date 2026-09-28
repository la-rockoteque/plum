using ValueObjectsEntitiesBefore = RepositoryExample.ValueObjectsEntities.Before;
using ValueObjectsEntitiesAfter = RepositoryExample.ValueObjectsEntities.After;
using Xunit;

namespace RepositoryExample.Tests;

public class ValueObjectsEntitiesTests
{
    [Fact]
    public void Before_AnInvalidStatusStringIsAccepted()
    {
        var order = new ValueObjectsEntitiesBefore.Order { Id = 1, Status = "pending", Total = 9.99, Currency = "USD" };
        order.Status = "definitely-not-a-status";
        Assert.Equal("definitely-not-a-status", order.Status);
    }

    [Fact]
    public void Before_ACancelledOrderCanBeMovedBackToPending()
    {
        var order = new ValueObjectsEntitiesBefore.Order { Id = 1, Status = "cancelled", Total = 9.99, Currency = "USD" };
        order.Status = "pending";
        Assert.Equal("pending", order.Status);
    }

    [Fact]
    public void Before_TotalsInDifferentCurrenciesAreAddedTogether()
    {
        var usdOrder = new ValueObjectsEntitiesBefore.Order { Id = 1, Status = "pending", Total = 10.0, Currency = "USD" };
        var eurOrder = new ValueObjectsEntitiesBefore.Order { Id = 2, Status = "pending", Total = 5.0, Currency = "EUR" };
        Assert.Equal(15.0, ValueObjectsEntitiesBefore.Totals.AddTotals(usdOrder, eurOrder));
    }

    [Fact]
    public void Before_RepeatedFloatAmountsDriftFromTheExactTotal()
    {
        var orders = new[]
        {
            new ValueObjectsEntitiesBefore.Order { Id = 0, Status = "pending", Total = 0.1, Currency = "USD" },
            new ValueObjectsEntitiesBefore.Order { Id = 1, Status = "pending", Total = 0.1, Currency = "USD" },
            new ValueObjectsEntitiesBefore.Order { Id = 2, Status = "pending", Total = 0.1, Currency = "USD" },
        };
        var total = ValueObjectsEntitiesBefore.Totals.AddTotals(orders[0], orders[1]) + orders[2].Total;
        Assert.NotEqual(0.3, total);
    }

    [Fact]
    public void Before_TheSameOrderComparesUnequalToItselfOnceItsStatusChanges()
    {
        var order = new ValueObjectsEntitiesBefore.Order { Id = 1, Status = "pending", Total = 9.99, Currency = "USD" };
        var sameOrderAfterCancelling = order with { Status = "cancelled" };
        Assert.NotEqual(order, sameOrderAfterCancelling);
    }

    [Fact]
    public void After_ParsingAnUnknownStatusIsRejected()
    {
        Assert.Throws<ValueObjectsEntitiesAfter.UnknownStatusException>(
            () => ValueObjectsEntitiesAfter.OrderStatuses.Parse("definitely-not-a-status"));
    }

    [Fact]
    public void After_ShippingAPendingOrderMovesItToShipped()
    {
        var order = new ValueObjectsEntitiesAfter.Order(1, ValueObjectsEntitiesAfter.OrderStatus.Pending,
            new ValueObjectsEntitiesAfter.Money(999, "USD"));
        order.Ship();
        Assert.Equal(ValueObjectsEntitiesAfter.OrderStatus.Shipped, order.Status);
    }

    [Fact]
    public void After_CancellingAShippedOrderIsRejected()
    {
        var order = new ValueObjectsEntitiesAfter.Order(1, ValueObjectsEntitiesAfter.OrderStatus.Pending,
            new ValueObjectsEntitiesAfter.Money(999, "USD"));
        order.Ship();
        Assert.Throws<ValueObjectsEntitiesAfter.InvalidStatusTransitionException>(() => order.Cancel());
    }

    [Fact]
    public void After_CancellingACancelledOrderIsRejected()
    {
        var order = new ValueObjectsEntitiesAfter.Order(1, ValueObjectsEntitiesAfter.OrderStatus.Pending,
            new ValueObjectsEntitiesAfter.Money(999, "USD"));
        order.Cancel();
        Assert.Throws<ValueObjectsEntitiesAfter.InvalidStatusTransitionException>(() => order.Cancel());
    }

    [Fact]
    public void After_ACancelledOrderCannotMoveBackToPending()
    {
        var order = new ValueObjectsEntitiesAfter.Order(1, ValueObjectsEntitiesAfter.OrderStatus.Pending,
            new ValueObjectsEntitiesAfter.Money(999, "USD"));
        order.Cancel();
        Assert.Throws<ValueObjectsEntitiesAfter.InvalidStatusTransitionException>(
            () => ValueObjectsEntitiesAfter.OrderStatuses.TransitionTo(order.Status, ValueObjectsEntitiesAfter.OrderStatus.Pending));
    }

    [Fact]
    public void After_AddingMoneyInDifferentCurrenciesIsRejected()
    {
        var usd = new ValueObjectsEntitiesAfter.Money(1000, "USD");
        var eur = new ValueObjectsEntitiesAfter.Money(500, "EUR");
        Assert.Throws<ValueObjectsEntitiesAfter.CurrencyMismatchException>(() => usd.Add(eur));
    }

    [Fact]
    public void After_RepeatedMoneyAmountsDoNotDrift()
    {
        var ten = new ValueObjectsEntitiesAfter.Money(10, "USD");
        var total = ten.Add(ten).Add(ten);
        Assert.Equal(new ValueObjectsEntitiesAfter.Money(30, "USD"), total);
    }

    [Fact]
    public void After_MoneyWithEqualAmountAndCurrencyIsEqualByValue()
    {
        Assert.Equal(new ValueObjectsEntitiesAfter.Money(1000, "USD"), new ValueObjectsEntitiesAfter.Money(1000, "USD"));
        Assert.NotEqual(new ValueObjectsEntitiesAfter.Money(1000, "USD"), new ValueObjectsEntitiesAfter.Money(1000, "EUR"));
    }

    [Fact]
    public void After_MoneyIsImmutable()
    {
        var a = new ValueObjectsEntitiesAfter.Money(1000, "USD");
        var b = new ValueObjectsEntitiesAfter.Money(500, "USD");
        var c = a.Add(b);
        Assert.Equal(new ValueObjectsEntitiesAfter.Money(1000, "USD"), a);
        Assert.Equal(new ValueObjectsEntitiesAfter.Money(1500, "USD"), c);
    }

    [Fact]
    public void After_TwoOrdersWithEqualFieldsButDifferentIdsAreNotEqual()
    {
        var total = new ValueObjectsEntitiesAfter.Money(500, "USD");
        var orderA = new ValueObjectsEntitiesAfter.Order(1, ValueObjectsEntitiesAfter.OrderStatus.Pending, total);
        var orderB = new ValueObjectsEntitiesAfter.Order(2, ValueObjectsEntitiesAfter.OrderStatus.Pending, total);
        Assert.NotEqual(orderA, orderB);

        var orderC = new ValueObjectsEntitiesAfter.Order(1, ValueObjectsEntitiesAfter.OrderStatus.Pending, total);
        orderC.Cancel();
        Assert.Equal(orderA, orderC);
    }
}
