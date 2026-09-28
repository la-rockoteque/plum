using RepositoryExample.Application;
using RepositoryExample.Cqrs;
using RepositoryExample.Domain;
using RepositoryExample.Infrastructure;
using Xunit;

namespace RepositoryExample.Tests;

public class CqrsTests
{
    [Fact]
    public void QueriesAreSnapshotsAndCommandsKeepDomainRules()
    {
        var repository = new InMemoryOrderRepository();
        repository.Save(new Order(1));
        var query = new GetOrderSummary(new InMemoryOrderSummaryReader(repository));
        var before = query.Execute(1);
        Assert.Equal(new OrderSummary(1, "pending", true), before);
        Assert.Equal(OrderStatus.Pending, repository.Get(1)!.Status);
        new CancelOrder(repository).Execute(1);
        Assert.Equal(new OrderSummary(1, "cancelled", false), query.Execute(1));
        Assert.Equal(new OrderSummary(1, "pending", true), before);
        Assert.Throws<OrderAlreadyCancelled>(() => new CancelOrder(repository).Execute(1));
        Assert.Equal(new OrderSummary(1, "cancelled", false), query.Execute(1));
    }

    [Fact]
    public void UnknownQueryDoesNotCreateOrder()
    {
        var repository = new InMemoryOrderRepository();
        var reader = new InMemoryOrderSummaryReader(repository);
        Assert.Null(reader.GetSummary(42));
        Assert.Throws<OrderNotFound>(() => new GetOrderSummary(reader).Execute(42));
        Assert.Null(repository.Get(42));
    }

    [Fact]
    public void BeforeReturnsWriteModel()
    {
        var repository = new InMemoryOrderRepository();
        repository.Save(new Order(1));
        var service = new Cqrs.Before.OrderService(repository);
        var order = service.CancelAndGet(1);
        Assert.IsType<Order>(order);
        Assert.Equal(OrderStatus.Cancelled, repository.Get(1)!.Status);
        Assert.Throws<OrderAlreadyCancelled>(() => service.CancelAndGet(1));
        Assert.Throws<OrderNotFound>(() => service.CancelAndGet(42));
    }
}
