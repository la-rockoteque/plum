using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using RepositoryExample.Application;
using RepositoryExample.Domain;
using RepositoryExample.Infrastructure;

namespace RepositoryExample.Orm;

public static class Demo
{
    public static void Run(string[] args)
    {
        if (args is not ["raw" or "orm" or "sql"])
        {
            Console.Error.WriteLine("Usage: dotnet run -- orm raw|orm|sql");
            Environment.ExitCode = 1;
            return;
        }
        using var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        IOrderRepository repository;
        if (args[0] == "raw")
        {
            SqliteOrderRepository.InitializeSchema(connection);
            repository = new SqliteOrderRepository(connection);
        }
        else
        {
            var builder = new DbContextOptionsBuilder<OrderDbContext>().UseSqlite(connection);
            if (args[0] == "sql") builder.LogTo(Console.WriteLine, [RelationalEventId.CommandExecuted]);
            using (var context = new OrderDbContext(builder.Options))
                context.Database.EnsureCreated();
            repository = new EfOrderRepository(builder.Options);
        }
        repository.Save(new Order(1));
        new CancelOrder(repository).Execute(1);
        var order = repository.Get(1) ?? throw new InvalidOperationException("Order disappeared");
        Console.WriteLine($"Order {order.Id}: {order.Status.ToString().ToLowerInvariant()}");
    }
}
