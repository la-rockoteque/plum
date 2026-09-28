using Microsoft.Data.Sqlite;
using RepositoryExample.Application;
using RepositoryExample.Domain;
using RepositoryExample.Infrastructure;

// Composition root: only construction changes when selecting an adapter.
if (args is ["di", .. var diArgs])
    RepositoryExample.DependencyInjection.Demo.Run(diArgs);
else if (args is ["cqrs", .. var cqrsArgs])
    RepositoryExample.Cqrs.Demo.Run(cqrsArgs);
else if (args is ["orm", .. var ormArgs])
    RepositoryExample.Orm.Demo.Run(ormArgs);
else if (args is ["uow"])
    RepositoryExample.UnitOfWork.Demo.Run();
else if (args is ["memory"])
    Demonstrate(new InMemoryOrderRepository());
else if (args is ["sqlite"])
{
    using var connection = new SqliteConnection("Data Source=:memory:");
    connection.Open();
    SqliteOrderRepository.InitializeSchema(connection);
    Demonstrate(new SqliteOrderRepository(connection));
}
else
{
    Console.Error.WriteLine("Usage: dotnet run -- memory|sqlite|di <stage>|cqrs <mode>|orm <mode>|uow");
    Environment.ExitCode = 1;
}

static void Demonstrate(IOrderRepository repository)
{
    repository.Save(new Order(1));
    new CancelOrder(repository).Execute(1);
    var order = repository.Get(1) ?? throw new InvalidOperationException("Order disappeared");
    if (order.Status != OrderStatus.Cancelled) throw new InvalidOperationException("Cancel failed");
    Console.WriteLine($"Order {order.Id}: {order.Status.ToString().ToLowerInvariant()}");
}
