using Microsoft.Data.Sqlite;

namespace RepositoryExample.LayeredArchitecture.After;

// Data-layer adapter for tests and demos: same contract, no database.
public sealed class InMemoryOrderRepository : IOrderRepository
{
    private readonly Dictionary<int, Order> orders = [];

    public Order? Get(int orderId) => orders.TryGetValue(orderId, out var order)
        ? new Order(order.Id, order.Status)
        : null;

    public void Save(Order order) => orders[order.Id] = new Order(order.Id, order.Status);
}

// Data-layer adapter over SQLite. Caller owns the open connection.
public sealed class SqliteOrderRepository(SqliteConnection connection) : IOrderRepository
{
    public static void InitializeSchema(SqliteConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, status TEXT NOT NULL)
            """;
        command.ExecuteNonQuery();
    }

    public Order? Get(int orderId)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT id, status FROM orders WHERE id = $id";
        command.Parameters.AddWithValue("$id", orderId);
        using var reader = command.ExecuteReader();
        if (!reader.Read()) return null;
        var status = reader.GetString(1) switch
        {
            "pending" => OrderStatus.Pending,
            "shipped" => OrderStatus.Shipped,
            "cancelled" => OrderStatus.Cancelled,
            var value => throw new InvalidOperationException($"Unknown order status: {value}")
        };
        return new Order(reader.GetInt32(0), status);
    }

    public void Save(Order order)
    {
        var status = order.Status switch
        {
            OrderStatus.Pending => "pending",
            OrderStatus.Shipped => "shipped",
            OrderStatus.Cancelled => "cancelled",
            _ => throw new InvalidOperationException($"Unknown order status: {order.Status}")
        };
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO orders (id, status) VALUES ($id, $status)
            ON CONFLICT(id) DO UPDATE SET status = excluded.status
            """;
        command.Parameters.AddWithValue("$id", order.Id);
        command.Parameters.AddWithValue("$status", status);
        command.ExecuteNonQuery();
    }
}
