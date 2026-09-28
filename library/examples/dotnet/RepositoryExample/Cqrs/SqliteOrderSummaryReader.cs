using Microsoft.Data.Sqlite;

namespace RepositoryExample.Cqrs;

public sealed class SqliteOrderSummaryReader(SqliteConnection connection) : IOrderSummaryReader
{
    public OrderSummary? GetSummary(int orderId)
    {
        // Project straight into display data; don't load a domain entity.
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT id, status, status = 'pending' FROM orders WHERE id = $id";
        command.Parameters.AddWithValue("$id", orderId);
        using var reader = command.ExecuteReader();
        return reader.Read()
            ? new OrderSummary(reader.GetInt32(0), reader.GetString(1), reader.GetBoolean(2))
            : null;
    }
}
