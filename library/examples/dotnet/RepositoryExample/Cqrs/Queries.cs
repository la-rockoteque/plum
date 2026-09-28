using RepositoryExample.Application;

namespace RepositoryExample.Cqrs;

public sealed record OrderSummary(int Id, string Status, bool CanCancel);

public interface IOrderSummaryReader
{
    OrderSummary? GetSummary(int orderId);
}

public sealed class GetOrderSummary(IOrderSummaryReader reader)
{
    public OrderSummary Execute(int orderId) =>
        reader.GetSummary(orderId) ?? throw new OrderNotFound(orderId);
}
