using Microsoft.Data.Sqlite;

namespace RepositoryExample.Before;

public sealed class CancelOrder(SqliteConnection connection)
{
    public void Execute(int orderId)
    {
        // SQL, table/column names, and the business rule live together.
        // Tests need persistence; a storage change can force application changes.
        using var query = connection.CreateCommand();
        query.CommandText = "SELECT status FROM orders WHERE id = $id";
        query.Parameters.AddWithValue("$id", orderId);
        var status = query.ExecuteScalar() as string
            ?? throw new InvalidOperationException($"Order {orderId} not found");
        if (status == "cancelled")
            throw new InvalidOperationException($"Order {orderId} already cancelled");
        using var update = connection.CreateCommand();
        update.CommandText = "UPDATE orders SET status = 'cancelled' WHERE id = $id";
        update.Parameters.AddWithValue("$id", orderId);
        update.ExecuteNonQuery();
    }
}
