using Microsoft.EntityFrameworkCore;
using RepositoryExample.Application;
using RepositoryExample.Domain;

namespace RepositoryExample.Orm;

public sealed class EfOrderRepository(DbContextOptions<OrderDbContext> options) : IOrderRepository
{
    public Order? Get(int orderId)
    {
        using var context = new OrderDbContext(options);
        var row = context.Orders.AsNoTracking().SingleOrDefault(row => row.Id == orderId);
        if (row is null) return null;
        var status = row.Status switch
        {
            "pending" => OrderStatus.Pending,
            "cancelled" => OrderStatus.Cancelled,
            _ => throw new InvalidOperationException($"Unknown order status: {row.Status}")
        };
        return new Order(row.Id, status);
    }

    public void Save(Order order)
    {
        using var context = new OrderDbContext(options);
        var row = context.Orders.Find(order.Id);
        if (row is null)
        {
            row = new OrderRow { Id = order.Id };
            context.Orders.Add(row);
        }
        row.Status = order.Status switch
        {
            OrderStatus.Pending => "pending",
            OrderStatus.Cancelled => "cancelled",
            _ => throw new InvalidOperationException($"Unknown order status: {order.Status}")
        };
        context.SaveChanges();
    }
}
