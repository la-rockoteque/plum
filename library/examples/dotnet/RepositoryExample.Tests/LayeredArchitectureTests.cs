using LayeredAfter = RepositoryExample.LayeredArchitecture.After;
using LayeredBefore = RepositoryExample.LayeredArchitecture.Before;
using Microsoft.Data.Sqlite;
using Xunit;

namespace RepositoryExample.Tests;

public class LayeredArchitectureTests
{
    [Fact]
    public void Before_ProvingTheCancellationRuleRequiresARequestAndADatabase()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        using (var create = connection.CreateCommand())
        {
            create.CommandText = "CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT)";
            create.ExecuteNonQuery();
        }
        using (var insert = connection.CreateCommand())
        {
            insert.CommandText = "INSERT INTO orders VALUES (1, 'pending'), (2, 'shipped')";
            insert.ExecuteNonQuery();
        }

        var response = LayeredBefore.CancelOrderHandler.Handle(new LayeredBefore.CancelRequest("1"), connection);
        Assert.Equal(new LayeredBefore.CancelResponse("ok", "order 1 cancelled"), response);
        using (var check = connection.CreateCommand())
        {
            check.CommandText = "SELECT status FROM orders WHERE id = 1";
            Assert.Equal("cancelled", check.ExecuteScalar());
        }

        // Proving the rule (a shipped order can't be cancelled) needs this same database.
        Assert.Equal("rejected", LayeredBefore.CancelOrderHandler.Handle(new LayeredBefore.CancelRequest("2"), connection).Status);
        Assert.Equal("rejected", LayeredBefore.CancelOrderHandler.Handle(new LayeredBefore.CancelRequest("1"), connection).Status);
        Assert.Equal("not_found", LayeredBefore.CancelOrderHandler.Handle(new LayeredBefore.CancelRequest("42"), connection).Status);
        Assert.Equal("invalid", LayeredBefore.CancelOrderHandler.Handle(new LayeredBefore.CancelRequest("nope"), connection).Status);
    }

    [Fact]
    public void After_TheDomainRuleRejectsAShippedOrderWithNoRequestOrDatabase()
    {
        var order = new LayeredAfter.Order(1, LayeredAfter.OrderStatus.Shipped);
        Assert.Throws<LayeredAfter.OrderCannotBeCancelled>(order.Cancel);
    }

    [Fact]
    public void After_TheDomainRuleRejectsACancelledOrderWithNoRequestOrDatabase()
    {
        var order = new LayeredAfter.Order(1, LayeredAfter.OrderStatus.Cancelled);
        Assert.Throws<LayeredAfter.OrderCannotBeCancelled>(order.Cancel);
    }

    [Fact]
    public void After_TheDomainRuleCancelsAPendingOrder()
    {
        var order = new LayeredAfter.Order(1);
        order.Cancel();
        Assert.Equal(LayeredAfter.OrderStatus.Cancelled, order.Status);
    }

    [Fact]
    public void After_TheApplicationServiceCancelsThroughAnInMemoryRepository()
    {
        var repository = new LayeredAfter.InMemoryOrderRepository();
        repository.Save(new LayeredAfter.Order(1));
        new LayeredAfter.CancelOrder(repository).Execute(1);
        Assert.Equal(LayeredAfter.OrderStatus.Cancelled, repository.Get(1)!.Status);

        Assert.Throws<LayeredAfter.OrderNotFound>(() => new LayeredAfter.CancelOrder(repository).Execute(42));

        repository.Save(new LayeredAfter.Order(2, LayeredAfter.OrderStatus.Shipped));
        Assert.Throws<LayeredAfter.OrderCannotBeCancelled>(() => new LayeredAfter.CancelOrder(repository).Execute(2));
    }

    private sealed class FakeCancelOrder(Exception? error = null) : LayeredAfter.ICancelOrderUseCase
    {
        public int? CalledWith { get; private set; }

        public void Execute(int orderId)
        {
            CalledWith = orderId;
            if (error is not null) throw error;
        }
    }

    [Fact]
    public void After_TheHandlerCancelsThroughAFakeApplicationService()
    {
        var useCase = new FakeCancelOrder();
        var response = LayeredAfter.CancelOrderHandler.Handle(new LayeredAfter.CancelRequest("1"), useCase);
        Assert.Equal(new LayeredAfter.CancelResponse("ok", "order 1 cancelled"), response);
        Assert.Equal(1, useCase.CalledWith);

        Assert.Equal("invalid", LayeredAfter.CancelOrderHandler.Handle(new LayeredAfter.CancelRequest("nope"), new FakeCancelOrder()).Status);
        Assert.Equal("not_found", LayeredAfter.CancelOrderHandler.Handle(new LayeredAfter.CancelRequest("1"), new FakeCancelOrder(new LayeredAfter.OrderNotFound(1))).Status);
        Assert.Equal("rejected", LayeredAfter.CancelOrderHandler.Handle(new LayeredAfter.CancelRequest("1"), new FakeCancelOrder(new LayeredAfter.OrderCannotBeCancelled(1, LayeredAfter.OrderStatus.Shipped))).Status);
    }

    [Fact]
    public void After_PresentationApplicationDomainAndDataCancelAnOrderOnSqlite()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        LayeredAfter.SqliteOrderRepository.InitializeSchema(connection);
        var repository = new LayeredAfter.SqliteOrderRepository(connection);
        repository.Save(new LayeredAfter.Order(1));
        repository.Save(new LayeredAfter.Order(2, LayeredAfter.OrderStatus.Shipped));

        var useCase = new LayeredAfter.CancelOrder(repository);
        var response = LayeredAfter.CancelOrderHandler.Handle(new LayeredAfter.CancelRequest("1"), useCase);
        Assert.Equal(new LayeredAfter.CancelResponse("ok", "order 1 cancelled"), response);
        Assert.Equal(LayeredAfter.OrderStatus.Cancelled, repository.Get(1)!.Status);
        Assert.Equal("rejected", LayeredAfter.CancelOrderHandler.Handle(new LayeredAfter.CancelRequest("2"), useCase).Status);
        Assert.Equal("not_found", LayeredAfter.CancelOrderHandler.Handle(new LayeredAfter.CancelRequest("42"), useCase).Status);
        Assert.Equal("invalid", LayeredAfter.CancelOrderHandler.Handle(new LayeredAfter.CancelRequest("nope"), useCase).Status);
    }
}
