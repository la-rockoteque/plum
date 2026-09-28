namespace RepositoryExample.LayeredArchitecture.After;

public sealed record CancelRequest(string OrderId); // arrives as a string, as it would from a web request

public sealed record CancelResponse(string Status, string Message); // "ok" | "invalid" | "not_found" | "rejected"

// What the handler depends on: the application layer, not any one implementation.
public interface ICancelOrderUseCase
{
    void Execute(int orderId);
}

public static class CancelOrderHandler
{
    // Presentation layer: parse the request into a command, call the use case, shape a response.
    public static CancelResponse Handle(CancelRequest request, ICancelOrderUseCase useCase)
    {
        if (!int.TryParse(request.OrderId, out var orderId))
            return new CancelResponse("invalid", "order id must be a number");

        try
        {
            useCase.Execute(orderId);
        }
        catch (OrderNotFound)
        {
            return new CancelResponse("not_found", $"order {orderId} not found");
        }
        catch (OrderCannotBeCancelled error)
        {
            return new CancelResponse("rejected", error.Message);
        }
        return new CancelResponse("ok", $"order {orderId} cancelled");
    }
}
