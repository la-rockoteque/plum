using SrpBefore = RepositoryExample.SingleResponsibility.Before;
using SrpAfter = RepositoryExample.SingleResponsibility.After;
using Xunit;

namespace RepositoryExample.Tests;

public class SingleResponsibilityTests
{
    [Fact]
    public void Before_CancellingAShippedOrderIsRejected()
    {
        var service = new SrpBefore.OrderService();
        var order = new SrpBefore.Order
        {
            Id = "O-1", CustomerName = "Ada", CustomerEmail = "ada@example.com", Status = "shipped",
        };
        var error = Assert.Throws<InvalidOperationException>(() => service.Cancel(order, "changed my mind"));
        Assert.Equal("cannot cancel a shipped order", error.Message);
        Assert.Equal("shipped", order.Status);
        Assert.Empty(service.SentEmails);
        Assert.Empty(service.AuditLog);
    }

    [Fact]
    public void Before_CancellingAPendingOrderSendsTheConfirmationEmail()
    {
        var service = new SrpBefore.OrderService();
        var order = new SrpBefore.Order { Id = "O-1", CustomerName = "Ada", CustomerEmail = "ada@example.com" };
        service.Cancel(order, "changed my mind");
        Assert.Equal("cancelled", order.Status);
        Assert.Equal(
            new[] { "Dear Ada, your order O-1 was cancelled. Reason: changed my mind." },
            service.SentEmails);
    }

    [Fact]
    public void Before_CancellingAPendingOrderWritesAnAuditEntry()
    {
        var service = new SrpBefore.OrderService();
        var order = new SrpBefore.Order { Id = "O-1", CustomerName = "Ada", CustomerEmail = "ada@example.com" };
        service.Cancel(order, "changed my mind");
        Assert.Equal(new[] { "O-1|CANCELLED|changed my mind" }, service.AuditLog);
    }

    [Fact]
    public void After_CancellingAShippedOrderIsRejectedBeforeNotifyingOrAuditing()
    {
        var notifier = new SrpAfter.OrderNotifier();
        var auditLog = new SrpAfter.AuditLog();
        var useCase = new SrpAfter.CancelOrder(notifier, auditLog);
        var order = new SrpAfter.Order
        {
            Id = "O-1", CustomerName = "Ada", CustomerEmail = "ada@example.com", Status = "shipped",
        };
        var error = Assert.Throws<InvalidOperationException>(() => useCase.Execute(order, "changed my mind"));
        Assert.Equal("cannot cancel a shipped order", error.Message);
        Assert.Equal("shipped", order.Status);
        Assert.Empty(notifier.Sent);
        Assert.Empty(auditLog.Entries);
    }

    [Fact]
    public void After_CancellingAPendingOrderNotifiesAndAuditsThroughItsCollaborators()
    {
        var notifier = new SrpAfter.OrderNotifier();
        var auditLog = new SrpAfter.AuditLog();
        var useCase = new SrpAfter.CancelOrder(notifier, auditLog);
        var order = new SrpAfter.Order { Id = "O-1", CustomerName = "Ada", CustomerEmail = "ada@example.com" };
        useCase.Execute(order, "changed my mind");
        Assert.Equal("cancelled", order.Status);
        Assert.Equal(
            new[] { "Dear Ada, your order O-1 was cancelled. Reason: changed my mind." },
            notifier.Sent);
        Assert.Equal(new[] { "O-1|CANCELLED|changed my mind" }, auditLog.Entries);
    }

    [Fact]
    public void After_TheNotifierFormatsTheCancellationEmailOnItsOwn()
    {
        var notifier = new SrpAfter.OrderNotifier();
        var order = new SrpAfter.Order { Id = "O-1", CustomerName = "Ada", CustomerEmail = "ada@example.com" };
        notifier.NotifyCancelled(order, "changed my mind");
        Assert.Equal(
            new[] { "Dear Ada, your order O-1 was cancelled. Reason: changed my mind." },
            notifier.Sent);
    }

    [Fact]
    public void After_TheAuditLogRecordsTheCancellationOnItsOwn()
    {
        var auditLog = new SrpAfter.AuditLog();
        var order = new SrpAfter.Order { Id = "O-1", CustomerName = "Ada", CustomerEmail = "ada@example.com" };
        auditLog.RecordCancelled(order, "changed my mind");
        Assert.Equal(new[] { "O-1|CANCELLED|changed my mind" }, auditLog.Entries);
    }
}
