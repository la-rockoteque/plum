using DomainEventsBefore = RepositoryExample.DomainEvents.Before;
using DomainEventsAfter = RepositoryExample.DomainEvents.After;
using Xunit;

namespace RepositoryExample.Tests;

public class DomainEventsTests
{
    private sealed class FixedClock : DomainEventsAfter.IClock
    {
        private readonly long _ms;
        public FixedClock(long ms) => _ms = ms;
        public long NowMs() => _ms;
    }

    private sealed class FakeInventoryService : DomainEventsBefore.IInventoryService, DomainEventsAfter.IInventoryService
    {
        public List<int> Released { get; } = new();
        public void Release(int orderId) => Released.Add(orderId);
    }

    private sealed class FakeMailer : DomainEventsBefore.IMailer, DomainEventsAfter.IMailer
    {
        public List<int> Sent { get; } = new();
        public void SendCancellationEmail(int orderId) => Sent.Add(orderId);
    }

    private sealed class MailerUnavailableException : Exception
    {
        public MailerUnavailableException(string message) : base(message) { }
    }

    private sealed class FailingMailer : DomainEventsBefore.IMailer, DomainEventsAfter.IMailer
    {
        public void SendCancellationEmail(int orderId) => throw new MailerUnavailableException("mailer unavailable");
    }

    private sealed class FakeLoyaltyLedger : DomainEventsBefore.ILoyaltyLedger, DomainEventsAfter.ILoyaltyLedger
    {
        public List<int> Recorded { get; } = new();
        public void RecordCancellation(int orderId) => Recorded.Add(orderId);
    }

    private sealed class StorageUnavailableException : Exception
    {
        public StorageUnavailableException(string message) : base(message) { }
    }

    private sealed class FailingSaveOrderRepository : DomainEventsAfter.IOrderRepository
    {
        private readonly DomainEventsAfter.InMemoryOrderRepository _inner = new();
        public bool FailOnSave { get; set; }
        public DomainEventsAfter.Order? Get(int orderId) => _inner.Get(orderId);
        public void Save(DomainEventsAfter.Order order)
        {
            if (FailOnSave) throw new StorageUnavailableException("storage unavailable");
            _inner.Save(order);
        }
    }

    [Fact]
    public void Before_CancellingCallsTheInventoryMailerAndLoyaltyCollaboratorsDirectly()
    {
        var inventory = new FakeInventoryService();
        var mailer = new FakeMailer();
        var loyalty = new FakeLoyaltyLedger();
        var order = new DomainEventsBefore.Order(1, inventory, mailer, loyalty);

        order.Cancel("customer request");

        Assert.Equal(new[] { 1 }, inventory.Released);
        Assert.Equal(new[] { 1 }, mailer.Sent);
        Assert.Equal(new[] { 1 }, loyalty.Recorded);
        Assert.Equal("cancelled", order.Status);
    }

    [Fact]
    public void Before_AFailingMailerLeavesInventoryReleasedButTheOrderNotCancelled()
    {
        var inventory = new FakeInventoryService();
        var loyalty = new FakeLoyaltyLedger();
        var order = new DomainEventsBefore.Order(1, inventory, new FailingMailer(), loyalty);

        Assert.Throws<MailerUnavailableException>(() => order.Cancel("customer request"));

        Assert.Equal(new[] { 1 }, inventory.Released); // already ran
        Assert.Empty(loyalty.Recorded); // never reached
        Assert.Equal("pending", order.Status); // inconsistent: inventory thinks it's released, order disagrees
    }

    [Fact]
    public void After_CancelRecordsExactlyOneOrderCancelledEventWithTheRightData()
    {
        var order = new DomainEventsAfter.Order(1);

        order.Cancel("customer request", new FixedClock(1000));
        var events = order.PullEvents();

        var expected = new DomainEventsAfter.OrderCancelled(1, "customer request", 1000);
        Assert.Equal(new[] { expected }, events);
        Assert.Equal("cancelled", order.Status);
    }

    [Fact]
    public void After_CancellingThroughTheServiceDispatchesToEveryRegisteredHandlerAfterASuccessfulSave()
    {
        var repo = new DomainEventsAfter.InMemoryOrderRepository();
        repo.Save(new DomainEventsAfter.Order(1));
        var dispatcher = new DomainEventsAfter.EventDispatcher();
        var inventory = new FakeInventoryService();
        var mailer = new FakeMailer();
        var loyalty = new FakeLoyaltyLedger();
        dispatcher.Register(typeof(DomainEventsAfter.OrderCancelled), new DomainEventsAfter.ReleaseInventoryHandler(inventory));
        dispatcher.Register(typeof(DomainEventsAfter.OrderCancelled), new DomainEventsAfter.SendCancellationEmailHandler(mailer));
        dispatcher.Register(typeof(DomainEventsAfter.OrderCancelled), new DomainEventsAfter.RecordLoyaltyCancellationHandler(loyalty));
        var service = new DomainEventsAfter.CancelOrderService(repo, dispatcher, new FixedClock(1000));

        service.Cancel(1, "customer request");

        Assert.Equal(new[] { 1 }, inventory.Released);
        Assert.Equal(new[] { 1 }, mailer.Sent);
        Assert.Equal(new[] { 1 }, loyalty.Recorded);
        Assert.Equal("cancelled", repo.Get(1)!.Status);
    }

    [Fact]
    public void After_EventsAreNotDispatchedWhenTheSaveFails()
    {
        var repo = new FailingSaveOrderRepository();
        repo.Save(new DomainEventsAfter.Order(1));
        var dispatcher = new DomainEventsAfter.EventDispatcher();
        var mailer = new FakeMailer();
        dispatcher.Register(typeof(DomainEventsAfter.OrderCancelled), new DomainEventsAfter.SendCancellationEmailHandler(mailer));
        var service = new DomainEventsAfter.CancelOrderService(repo, dispatcher, new FixedClock(1000));
        repo.FailOnSave = true;

        Assert.Throws<StorageUnavailableException>(() => service.Cancel(1, "customer request"));

        Assert.Empty(mailer.Sent);
    }

    [Fact]
    public void After_TheInventoryHandlerReleasesInventoryForTheCancelledOrder()
    {
        var inventory = new FakeInventoryService();
        var handler = new DomainEventsAfter.ReleaseInventoryHandler(inventory);

        handler.Handle(new DomainEventsAfter.OrderCancelled(1, "customer request", 1000));

        Assert.Equal(new[] { 1 }, inventory.Released);
    }

    [Fact]
    public void After_TheMailerHandlerSendsACancellationEmail()
    {
        var mailer = new FakeMailer();
        var handler = new DomainEventsAfter.SendCancellationEmailHandler(mailer);

        handler.Handle(new DomainEventsAfter.OrderCancelled(1, "customer request", 1000));

        Assert.Equal(new[] { 1 }, mailer.Sent);
    }

    [Fact]
    public void After_TheLoyaltyHandlerRecordsTheCancellation()
    {
        var loyalty = new FakeLoyaltyLedger();
        var handler = new DomainEventsAfter.RecordLoyaltyCancellationHandler(loyalty);

        handler.Handle(new DomainEventsAfter.OrderCancelled(1, "customer request", 1000));

        Assert.Equal(new[] { 1 }, loyalty.Recorded);
    }

    [Fact]
    public void After_AFailingHandlerDoesNotUndoTheCancellation()
    {
        var repo = new DomainEventsAfter.InMemoryOrderRepository();
        repo.Save(new DomainEventsAfter.Order(1));
        var dispatcher = new DomainEventsAfter.EventDispatcher();
        var inventory = new FakeInventoryService();
        var loyalty = new FakeLoyaltyLedger();
        dispatcher.Register(typeof(DomainEventsAfter.OrderCancelled), new DomainEventsAfter.ReleaseInventoryHandler(inventory));
        dispatcher.Register(typeof(DomainEventsAfter.OrderCancelled), new DomainEventsAfter.SendCancellationEmailHandler(new FailingMailer()));
        dispatcher.Register(typeof(DomainEventsAfter.OrderCancelled), new DomainEventsAfter.RecordLoyaltyCancellationHandler(loyalty));
        var service = new DomainEventsAfter.CancelOrderService(repo, dispatcher, new FixedClock(1000));

        Assert.Throws<MailerUnavailableException>(() => service.Cancel(1, "customer request"));

        Assert.Equal("cancelled", repo.Get(1)!.Status); // the save already committed before the handler ran
        Assert.Equal(new[] { 1 }, inventory.Released); // handler before the failing one still ran
        Assert.Empty(loyalty.Recorded); // handler after the failing one never ran
    }
}
