using SrpBefore = RepositoryExample.SingleResponsibility.Before;
using SrpAfter = RepositoryExample.SingleResponsibility.After;
using Xunit;

namespace RepositoryExample.Tests;

public class SingleResponsibilityTests
{
    // Satisfies CancelOrder's INotifier port; records only (orderId, reason),
    // never the wording OrderNotifier produces from it.
    private sealed class NotifierSpy : SrpAfter.INotifier
    {
        public List<(int OrderId, string Reason)> Notified { get; } = [];

        public void NotifyCancelled(SrpAfter.Order order, string reason) =>
            Notified.Add((order.Id, reason));
    }

    // Satisfies CancelOrder's IAuditor port; records only (orderId, reason),
    // never the format AuditLog produces from it.
    private sealed class AuditorSpy : SrpAfter.IAuditor
    {
        public List<(int OrderId, string Reason)> Audited { get; } = [];

        public void RecordCancelled(SrpAfter.Order order, string reason) =>
            Audited.Add((order.Id, reason));
    }

    [Fact]
    public void Before_CancellingAShippedOrderIsRejected()
    {
        var service = new SrpBefore.OrderService();
        var order = new SrpBefore.Order
        {
            Id = 1, CustomerName = "Ada", CustomerEmail = "ada@example.com", Status = SrpBefore.OrderStatus.Shipped,
        };
        var error = Assert.Throws<InvalidOperationException>(() => service.Cancel(order, "changed my mind"));
        Assert.Equal("cannot cancel a shipped or cancelled order", error.Message);
        Assert.Equal(SrpBefore.OrderStatus.Shipped, order.Status);
        Assert.Empty(service.SentEmails);
        Assert.Empty(service.AuditLog);
    }

    [Fact]
    public void Before_CancellingACancelledOrderIsRejected()
    {
        var service = new SrpBefore.OrderService();
        var order = new SrpBefore.Order
        {
            Id = 1, CustomerName = "Ada", CustomerEmail = "ada@example.com", Status = SrpBefore.OrderStatus.Cancelled,
        };
        var error = Assert.Throws<InvalidOperationException>(() => service.Cancel(order, "changed my mind"));
        Assert.Equal("cannot cancel a shipped or cancelled order", error.Message);
        Assert.Empty(service.SentEmails);
        Assert.Empty(service.AuditLog);
    }

    [Fact]
    public void Before_CancellingAPendingOrderSendsTheConfirmationEmail()
    {
        var service = new SrpBefore.OrderService();
        var order = new SrpBefore.Order { Id = 1, CustomerName = "Ada", CustomerEmail = "ada@example.com" };
        service.Cancel(order, "changed my mind");
        Assert.Equal(SrpBefore.OrderStatus.Cancelled, order.Status);
        Assert.Equal(
            new[] { "Dear Ada, your order 1 was cancelled. Reason: changed my mind." },
            service.SentEmails);
    }

    [Fact]
    public void Before_CancellingAPendingOrderWritesAnAuditEntry()
    {
        var service = new SrpBefore.OrderService();
        var order = new SrpBefore.Order { Id = 1, CustomerName = "Ada", CustomerEmail = "ada@example.com" };
        service.Cancel(order, "changed my mind");
        Assert.Equal(new[] { "1|CANCELLED|changed my mind" }, service.AuditLog);
    }

    // Change cost: Cancel() cannot be exercised without producing the email,
    // so the same test that proves the cancellation rule must also pin the
    // exact wording — for any reason text. Two reasons, two literal strings,
    // one test (this one, not a notifier's) to edit either way.
    [Theory]
    [InlineData("changed my mind", "Dear Ada, your order 1 was cancelled. Reason: changed my mind.")]
    [InlineData("duplicate order", "Dear Ada, your order 1 was cancelled. Reason: duplicate order.")]
    public void Before_TheRuleTestIsCoupledToTheEmailWording(string reason, string wording)
    {
        var service = new SrpBefore.OrderService();
        var order = new SrpBefore.Order { Id = 1, CustomerName = "Ada", CustomerEmail = "ada@example.com" };
        service.Cancel(order, reason);
        Assert.Equal(SrpBefore.OrderStatus.Cancelled, order.Status);
        Assert.Equal(new[] { wording }, service.SentEmails);
    }

    [Fact]
    public void After_CancellingAShippedOrderIsRejectedBeforeNotifyingOrAuditing()
    {
        var notifier = new NotifierSpy();
        var auditLog = new AuditorSpy();
        var useCase = new SrpAfter.CancelOrder(notifier, auditLog);
        var order = new SrpAfter.Order
        {
            Id = 1, CustomerName = "Ada", CustomerEmail = "ada@example.com", Status = SrpAfter.OrderStatus.Shipped,
        };
        var error = Assert.Throws<InvalidOperationException>(() => useCase.Execute(order, "changed my mind"));
        Assert.Equal("cannot cancel a shipped or cancelled order", error.Message);
        Assert.Equal(SrpAfter.OrderStatus.Shipped, order.Status);
        Assert.Empty(notifier.Notified);
        Assert.Empty(auditLog.Audited);
    }

    [Fact]
    public void After_CancellingACancelledOrderIsRejectedBeforeNotifyingOrAuditing()
    {
        var notifier = new NotifierSpy();
        var auditLog = new AuditorSpy();
        var useCase = new SrpAfter.CancelOrder(notifier, auditLog);
        var order = new SrpAfter.Order
        {
            Id = 1, CustomerName = "Ada", CustomerEmail = "ada@example.com", Status = SrpAfter.OrderStatus.Cancelled,
        };
        var error = Assert.Throws<InvalidOperationException>(() => useCase.Execute(order, "changed my mind"));
        Assert.Equal("cannot cancel a shipped or cancelled order", error.Message);
        Assert.Empty(notifier.Notified);
        Assert.Empty(auditLog.Audited);
    }

    [Fact]
    public void After_CancellingAPendingOrderNotifiesAndAuditsThroughItsPorts()
    {
        var notifier = new NotifierSpy();
        var auditLog = new AuditorSpy();
        var useCase = new SrpAfter.CancelOrder(notifier, auditLog);
        var order = new SrpAfter.Order { Id = 1, CustomerName = "Ada", CustomerEmail = "ada@example.com" };
        useCase.Execute(order, "changed my mind");
        Assert.Equal(SrpAfter.OrderStatus.Cancelled, order.Status);
        Assert.Equal([(1, "changed my mind")], notifier.Notified);
        Assert.Equal([(1, "changed my mind")], auditLog.Audited);
    }

    [Fact]
    public void After_TheNotifierFormatsTheCancellationEmailOnItsOwn()
    {
        var notifier = new SrpAfter.OrderNotifier();
        var order = new SrpAfter.Order { Id = 1, CustomerName = "Ada", CustomerEmail = "ada@example.com" };
        notifier.NotifyCancelled(order, "changed my mind");
        Assert.Equal(
            new[] { "Dear Ada, your order 1 was cancelled. Reason: changed my mind." },
            notifier.Sent);
    }

    [Fact]
    public void After_TheAuditLogRecordsTheCancellationOnItsOwn()
    {
        var auditLog = new SrpAfter.AuditLog();
        var order = new SrpAfter.Order { Id = 1, CustomerName = "Ada", CustomerEmail = "ada@example.com" };
        auditLog.RecordCancelled(order, "changed my mind");
        Assert.Equal(new[] { "1|CANCELLED|changed my mind" }, auditLog.Entries);
    }
}
