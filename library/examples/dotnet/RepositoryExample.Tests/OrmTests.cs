using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using RepositoryExample.Application;
using RepositoryExample.Domain;
using RepositoryExample.Orm;
using Xunit;

namespace RepositoryExample.Tests;

public class OrmTests
{
    [Fact]
    public void EfKeepsRepositoryContract()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        var options = new DbContextOptionsBuilder<OrderDbContext>().UseSqlite(connection).Options;
        using (var context = new OrderDbContext(options)) context.Database.EnsureCreated();
        var repository = new EfOrderRepository(options);
        Assert.Null(repository.Get(42));
        Assert.Throws<OrderNotFound>(() => new CancelOrder(repository).Execute(42));
        var original = new Order(1);
        repository.Save(original);
        original.Cancel();
        var loaded = repository.Get(1)!;
        Assert.Equal(OrderStatus.Pending, loaded.Status);
        loaded.Cancel();
        Assert.Equal(OrderStatus.Pending, repository.Get(1)!.Status);
        new CancelOrder(repository).Execute(1);
        Assert.Equal(OrderStatus.Cancelled, repository.Get(1)!.Status);
        Assert.Throws<OrderAlreadyCancelled>(() => new CancelOrder(repository).Execute(1));
        using var query = connection.CreateCommand();
        query.CommandText = "SELECT status FROM orders WHERE id = 1";
        Assert.Equal("cancelled", query.ExecuteScalar());
        query.CommandText = "SELECT COUNT(*) FROM orders";
        Assert.Equal(1L, query.ExecuteScalar());
        query.CommandText = "UPDATE orders SET status = 'invalid' WHERE id = 1";
        query.ExecuteNonQuery();
        Assert.Throws<InvalidOperationException>(() => repository.Get(1));
    }
}
