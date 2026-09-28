namespace RepositoryExample.RedGreenRefactor.Red;

// No rule yet: any status can be cancelled.
public sealed class Order(string status = "pending")
{
    public string Status { get; private set; } = status;

    public void Cancel()
    {
        Status = "cancelled";
    }
}
