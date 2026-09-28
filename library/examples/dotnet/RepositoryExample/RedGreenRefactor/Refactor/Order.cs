namespace RepositoryExample.RedGreenRefactor.Refactor;

// Same behaviour as Green, named and in one place instead of a bare comparison inside Cancel. The public shape
// is identical to Green: the constructor takes a string, and Status is a string.
public sealed class Order(string status = "pending")
{
    // The rule, named instead of a bare comparison inside Cancel — internal only.
    private static readonly HashSet<string> NonCancellableStatuses = ["shipped"];

    public string Status { get; private set; } = status;

    public bool CanCancel() => !NonCancellableStatuses.Contains(Status);

    public void Cancel()
    {
        if (!CanCancel()) throw new InvalidOperationException("a shipped order can't be cancelled");
        Status = "cancelled";
    }
}
