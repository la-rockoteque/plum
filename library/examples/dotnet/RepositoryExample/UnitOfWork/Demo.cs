using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using RepositoryExample.Application;
using RepositoryExample.Domain;
using RepositoryExample.Orm;

namespace RepositoryExample.UnitOfWork;

public static class Demo
{
    public static void Run()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        var options = new DbContextOptionsBuilder<OrderDbContext>().UseSqlite(connection).Options;
        using (var context = new OrderDbContext(options)) context.Database.EnsureCreated();
        var repository = new EfOrderRepository(options);
        foreach (var mode in new[] { "before", "rollback", "commit" })
        {
            repository.Save(new Order(1));
            repository.Save(new Order(2));
            int[] ids = mode == "commit" ? [1, 2] : [1, 404];
            try
            {
                if (mode == "before")
                    foreach (var id in ids) new CancelOrder(repository).Execute(id);
                else Batch.CancelOrders(options, ids);
            }
            catch (OrderNotFound) when (mode != "commit") { }
            using var query = connection.CreateCommand();
            query.CommandText = "SELECT status FROM orders ORDER BY id";
            using var rows = query.ExecuteReader();
            var statuses = new List<string>();
            while (rows.Read()) statuses.Add(rows.GetString(0));
            string[] expected = mode == "before" ? ["cancelled", "pending"]
                : mode == "rollback" ? ["pending", "pending"] : ["cancelled", "cancelled"];
            if (!statuses.SequenceEqual(expected)) throw new InvalidOperationException("Unexpected stored state");
            Console.WriteLine($"{mode}: {string.Join(", ", statuses)}");
        }
    }
}
