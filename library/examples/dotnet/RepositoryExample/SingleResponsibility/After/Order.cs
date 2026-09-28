namespace RepositoryExample.SingleResponsibility.After;

public enum OrderStatus { Pending, Shipped, Cancelled }

public sealed class Order
{
    public required int Id { get; init; }
    public required string CustomerName { get; init; }
    public required string CustomerEmail { get; init; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
}
