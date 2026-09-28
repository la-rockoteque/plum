using Microsoft.Data.Sqlite;

namespace RepositoryExample.LayeredArchitecture.Before;

public sealed record CancelRequest(string OrderId); // arrives as a string, as it would from a web request

public sealed record CancelResponse(string Status, string Message); // "ok" | "invalid" | "not_found" | "rejected"

public static class CancelOrderHandler
{
    public static CancelResponse Handle(CancelRequest request, SqliteConnection connection)
    {
        // Parsing, the cancellation rule, and SQL all live in one function: a rule change
        // and a column rename both force an edit here, and proving the rule needs a database.
        if (!int.TryParse(request.OrderId, out var orderId))
            return new CancelResponse("invalid", "order id must be a number");

        using var query = connection.CreateCommand();
        query.CommandText = "SELECT status FROM orders WHERE id = $id";
        query.Parameters.AddWithValue("$id", orderId);
        var status = query.ExecuteScalar() as string;
        if (status is null) return new CancelResponse("not_found", $"order {orderId} not found");
        if (status is "shipped" or "cancelled")
            return new CancelResponse("rejected", $"order {orderId} already {status}");

        using var update = connection.CreateCommand();
        update.CommandText = "UPDATE orders SET status = 'cancelled' WHERE id = $id";
        update.Parameters.AddWithValue("$id", orderId);
        update.ExecuteNonQuery();
        return new CancelResponse("ok", $"order {orderId} cancelled");
    }
}
