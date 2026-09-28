using Microsoft.Data.Sqlite;
using RepositoryExample.Application;
using RepositoryExample.Cqrs;
using RepositoryExample.Domain;
using RepositoryExample.Infrastructure;
using Xunit;

namespace RepositoryExample.Tests;

public class CqrsSqliteTests
{
    [Fact]
    public void ReadAndWriteModelsShareOneDatabase()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        SqliteOrderRepository.InitializeSchema(connection);
        var repository = new SqliteOrderRepository(connection);
        var reader = new SqliteOrderSummaryReader(connection);
        var query = new GetOrderSummary(reader);
        Assert.Null(reader.GetSummary(42));
        Assert.Throws<OrderNotFound>(() => query.Execute(42));
        repository.Save(new Order(1));
        var before = query.Execute(1);
        Assert.Equal(new OrderSummary(1, "pending", true), before);
        Assert.Equal(OrderStatus.Pending, repository.Get(1)!.Status);
        new CancelOrder(repository).Execute(1);
        Assert.Equal(new OrderSummary(1, "cancelled", false), query.Execute(1));
        Assert.Equal(new OrderSummary(1, "pending", true), before);
    }
}
