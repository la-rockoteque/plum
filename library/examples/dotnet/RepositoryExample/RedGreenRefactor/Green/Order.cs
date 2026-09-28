namespace RepositoryExample.RedGreenRefactor.Green;

// Minimal fix: a bare status-string comparison, right where Cancel decides.
public sealed class Order(string status = "pending")
{
    public string Status { get; private set; } = status;

    public void Cancel()
    {
        if (Status == "shipped") throw new InvalidOperationException("a shipped order can't be cancelled");
        Status = "cancelled";
    }
}
