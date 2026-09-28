using Microsoft.EntityFrameworkCore;
using RepositoryExample.Application;
using RepositoryExample.Domain;
using RepositoryExample.Orm;

namespace RepositoryExample.UnitOfWork;

public static class Batch
{
    public static void CancelOrders(DbContextOptions<OrderDbContext> options, params int[] orderIds)
    {
        using var context = new OrderDbContext(options);
        using var transaction = context.Database.BeginTransaction();
        foreach (var id in orderIds)
        {
            var row = context.Orders.Find(id) ?? throw new OrderNotFound(id);
            var status = row.Status switch
            {
                "pending" => OrderStatus.Pending,
                "cancelled" => OrderStatus.Cancelled,
                _ => throw new InvalidOperationException($"Unknown order status: {row.Status}")
            };
            var order = new Order(row.Id, status);
            order.Cancel();
            row.Status = "cancelled";
            context.SaveChanges(); // Sends SQL; the outer transaction still owns commit.
        }
        transaction.Commit(); // Disposal rolls back if any preceding operation throws.
    }
}
