namespace RepositoryExample.SingleResponsibility.After;

// Owns the audit entry format — its only reason to change. Satisfies
// CancelOrder's IAuditor port; nothing declares it.
public sealed class AuditLog
{
    public List<string> Entries { get; } = [];

    public void RecordCancelled(Order order, string reason) =>
        Entries.Add($"{order.Id}|CANCELLED|{reason}");
}
