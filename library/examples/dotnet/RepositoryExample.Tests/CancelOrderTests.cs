using RepositoryExample.Application;
using RepositoryExample.Domain;
using RepositoryExample.Infrastructure;
using Xunit;

namespace RepositoryExample.Tests;

public class CancelOrderTests
{
    [Fact]
    public void CancelsPendingOrder()
    {
        var repository = new InMemoryOrderRepository();
        repository.Save(new Order(1));
        new CancelOrder(repository).Execute(1);
        Assert.Equal(OrderStatus.Cancelled, repository.Get(1)!.Status);
    }

    [Fact]
    public void RejectsUnknownOrder()
    {
        var repository = new InMemoryOrderRepository();
        Assert.Throws<OrderNotFound>(() => new CancelOrder(repository).Execute(1));
        Assert.Null(repository.Get(1));
    }

    [Fact]
    public void RejectsRepeatedCancellation()
    {
        var repository = new InMemoryOrderRepository();
        repository.Save(new Order(1, OrderStatus.Cancelled));
        Assert.Throws<OrderAlreadyCancelled>(() => new CancelOrder(repository).Execute(1));
        Assert.Equal(OrderStatus.Cancelled, repository.Get(1)!.Status);
    }
}
