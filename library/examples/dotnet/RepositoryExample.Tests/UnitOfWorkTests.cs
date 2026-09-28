using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using RepositoryExample.Application;
using RepositoryExample.Domain;
using RepositoryExample.Orm;
using RepositoryExample.UnitOfWork;
using Xunit;

namespace RepositoryExample.Tests;

public class UnitOfWorkTests
{
    [Fact]
    public void DemoComparesPartialSaveRollbackAndCommit() => UnitOfWork.Demo.Run();

    [Fact]
    public void FailureRollsBackSavedChangesAndNextUnitCanCommit()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        var options = new DbContextOptionsBuilder<OrderDbContext>().UseSqlite(connection).Options;
        using (var context = new OrderDbContext(options)) context.Database.EnsureCreated();
        var repository = new EfOrderRepository(options);
        repository.Save(new Order(1));
        repository.Save(new Order(2));
        Assert.Throws<OrderNotFound>(() => Batch.CancelOrders(options, 1, 404));
        Assert.Equal(OrderStatus.Pending, repository.Get(1)!.Status);
        Assert.Equal(OrderStatus.Pending, repository.Get(2)!.Status);
        Assert.Throws<OrderAlreadyCancelled>(() => Batch.CancelOrders(options, 1, 1));
        Assert.Equal(OrderStatus.Pending, repository.Get(1)!.Status);
        Batch.CancelOrders(options, 1, 2);
        Assert.Equal(OrderStatus.Cancelled, repository.Get(1)!.Status);
        Assert.Equal(OrderStatus.Cancelled, repository.Get(2)!.Status);
    }
}
