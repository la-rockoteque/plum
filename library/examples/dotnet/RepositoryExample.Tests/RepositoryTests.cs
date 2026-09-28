using Microsoft.Data.Sqlite;
using RepositoryExample.Application;
using RepositoryExample.Domain;
using RepositoryExample.Infrastructure;
using Xunit;

namespace RepositoryExample.Tests;

public class RepositoryTests
{
    [Theory]
    [InlineData("memory")]
    [InlineData("sqlite")]
    public void AdaptersMeetTheSameContract(string adapter)
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        IOrderRepository repository;
        if (adapter == "memory") repository = new InMemoryOrderRepository();
        else
        {
            connection.Open();
            SqliteOrderRepository.InitializeSchema(connection);
            repository = new SqliteOrderRepository(connection);
        }

        Assert.Null(repository.Get(42));
        var original = new Order(1);
        repository.Save(original);
        original.Cancel();
        var loaded = repository.Get(1)!;
        Assert.Equal(1, loaded.Id);
        Assert.Equal(OrderStatus.Pending, loaded.Status);
        loaded.Cancel();
        Assert.Equal(OrderStatus.Pending, repository.Get(1)!.Status);
        repository.Save(loaded);
        Assert.Equal(OrderStatus.Cancelled, repository.Get(1)!.Status);
    }

    [Fact]
    public void CoupledExampleNeedsADatabase()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        SqliteOrderRepository.InitializeSchema(connection);
        var repository = new SqliteOrderRepository(connection);
        repository.Save(new Order(1));
        var cancel = new Before.CancelOrder(connection);
        cancel.Execute(1);
        Assert.Equal(OrderStatus.Cancelled, repository.Get(1)!.Status);
        Assert.Throws<InvalidOperationException>(() => cancel.Execute(1));
        Assert.Throws<InvalidOperationException>(() => cancel.Execute(42));
    }
}
