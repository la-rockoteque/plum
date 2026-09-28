using Microsoft.Data.Sqlite;
using RepositoryExample.Application;
using RepositoryExample.Domain;
using RepositoryExample.Infrastructure;

namespace RepositoryExample.Cqrs;

public static class Demo
{
    public static void Run(string[] args)
    {
        switch (args)
        {
            case ["before"]:
                var beforeRepository = new InMemoryOrderRepository();
                beforeRepository.Save(new Order(1));
                var order = new Before.OrderService(beforeRepository).CancelAndGet(1);
                Console.WriteLine($"Order {order.Id}: {order.Status.ToString().ToLowerInvariant()}");
                break;
            case ["memory"]:
                var repository = new InMemoryOrderRepository();
                Demonstrate(repository, new InMemoryOrderSummaryReader(repository));
                break;
            case ["sqlite"]:
                using (var connection = new SqliteConnection("Data Source=:memory:"))
                {
                    connection.Open();
                    SqliteOrderRepository.InitializeSchema(connection);
                    Demonstrate(new SqliteOrderRepository(connection),
                        new SqliteOrderSummaryReader(connection));
                }
                break;
            default:
                Console.Error.WriteLine("Usage: dotnet run -- cqrs before|memory|sqlite");
                Environment.ExitCode = 1;
                break;
        }
    }

    private static void Demonstrate(IOrderRepository repository, IOrderSummaryReader reader)
    {
        repository.Save(new Order(1));
        var query = new GetOrderSummary(reader);
        var before = query.Execute(1);
        new CancelOrder(repository).Execute(1);
        var after = query.Execute(1);
        Console.WriteLine($"Before: {before.Status}, can_cancel={before.CanCancel.ToString().ToLowerInvariant()}");
        Console.WriteLine($"After: {after.Status}, can_cancel={after.CanCancel.ToString().ToLowerInvariant()}");
    }
}
