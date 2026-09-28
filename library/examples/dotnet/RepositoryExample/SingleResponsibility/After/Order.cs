namespace RepositoryExample.SingleResponsibility.After;

public sealed class Order
{
    public required string Id { get; init; }
    public required string CustomerName { get; init; }
    public required string CustomerEmail { get; init; }
    public string Status { get; set; } = "pending";
}
