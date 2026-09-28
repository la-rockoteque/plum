using TestDoublesAfter = RepositoryExample.TestDoubles.After;
using TestDoublesBefore = RepositoryExample.TestDoubles.Before;
using Xunit;

namespace RepositoryExample.Tests;

public class TestDoublesTests
{
    [Fact]
    public void Before_CancellingAnOrderBlowsUpInsteadOfCompleting()
    {
        var order = new TestDoublesBefore.Order(1, "ada@example.com", 500);
        var exception = Assert.Throws<InvalidOperationException>(() => new TestDoublesBefore.CancelOrder().Execute(order));
        Assert.Contains("network unavailable", exception.Message);
        // Nothing about the business outcome is observable: the order never even changed status.
        Assert.Equal("pending", order.Status);
    }

    // Dummy: satisfies the constructor. If a test ever asserted on this, it wouldn't be a dummy anymore.
    private sealed class NullAuditLogger : TestDoublesAfter.IAuditLogger
    {
        public void Log(string message) => throw new InvalidOperationException("dummy should never be called");
    }

    // Spy: records the decline message so the test can assert afterwards. The audit
    // logger becomes a real collaborator once a charge is declined.
    private sealed class SpyAuditLogger : TestDoublesAfter.IAuditLogger
    {
        public List<string> Messages { get; } = [];

        public void Log(string message) => Messages.Add(message);
    }

    // Fake: real get/save behaviour, no external system. Copies on write and on read, so
    // mutating what Get returns never leaks into storage until Save is called.
    private sealed class InMemoryOrderRepository : TestDoublesAfter.IOrderRepository
    {
        private readonly Dictionary<int, TestDoublesAfter.Order> _orders;

        public InMemoryOrderRepository(params TestDoublesAfter.Order[] orders) =>
            _orders = orders.ToDictionary(order => order.Id, Clone);

        public TestDoublesAfter.Order Get(int orderId) => Clone(_orders[orderId]);

        public void Save(TestDoublesAfter.Order order) => _orders[order.Id] = Clone(order);

        private static TestDoublesAfter.Order Clone(TestDoublesAfter.Order order) =>
            new(order.Id, order.CustomerEmail, order.AmountMinor) { Status = order.Status };
    }

    // Stub: a canned response. Nothing is recorded, nothing is verified.
    private sealed class StubPaymentGateway(TestDoublesAfter.ChargeResult result) : TestDoublesAfter.IPaymentGateway
    {
        public TestDoublesAfter.ChargeResult Charge(int orderId, int amountMinor) => result;
    }

    // Mock: a hand-rolled expectation. The wrong call fails immediately; the right one is recorded.
    private sealed class MockPaymentGateway(int expectedOrderId, int expectedAmountMinor) : TestDoublesAfter.IPaymentGateway
    {
        public bool Called { get; private set; }

        public TestDoublesAfter.ChargeResult Charge(int orderId, int amountMinor)
        {
            if (orderId != expectedOrderId || amountMinor != expectedAmountMinor)
            {
                throw new InvalidOperationException($"unexpected charge: {orderId} {amountMinor}");
            }
            Called = true;
            return TestDoublesAfter.ChargeResult.Approved;
        }
    }

    // Spy: records what was sent so the test can assert afterwards (state verification).
    private sealed class SpyMailer : TestDoublesAfter.IMailer
    {
        public List<(string To, string Message)> Sent { get; } = [];

        public void Send(string to, string message) => Sent.Add((to, message));
    }

    private static TestDoublesAfter.Order AnOrder(int amountMinor = 500) =>
        new(1, "ada@example.com", amountMinor);

    [Fact]
    public void After_DummyAuditLoggerIsPassedButNeverCalled()
    {
        var orders = new InMemoryOrderRepository(AnOrder());
        var useCase = new TestDoublesAfter.CancelOrder(orders, new StubPaymentGateway(TestDoublesAfter.ChargeResult.Approved), new SpyMailer(), new NullAuditLogger());
        useCase.Execute(1); // would throw if the dummy were ever invoked
    }

    [Fact]
    public void After_StubGatewayReturnsACannedDeclineAndTheOrderIsNotCancelled()
    {
        var orders = new InMemoryOrderRepository(AnOrder());
        var audit = new SpyAuditLogger();
        var useCase = new TestDoublesAfter.CancelOrder(orders, new StubPaymentGateway(TestDoublesAfter.ChargeResult.Declined), new SpyMailer(), audit);
        useCase.Execute(1);
        // The stub's canned decline is enough to keep the order out of the cancelled state...
        Assert.Equal(TestDoublesAfter.OrderStatus.Pending, orders.Get(1).Status);
        // ...and it drove a real call to the audit logger, which is no longer dead code.
        Assert.Equal(["charge declined for order 1"], audit.Messages);
    }

    [Fact]
    public void After_SpyMailerRecordsTheMessageItSent()
    {
        var orders = new InMemoryOrderRepository(AnOrder());
        var mailer = new SpyMailer();
        new TestDoublesAfter.CancelOrder(orders, new StubPaymentGateway(TestDoublesAfter.ChargeResult.Approved), mailer, new NullAuditLogger()).Execute(1);
        Assert.Equal([("ada@example.com", "Your order 1 was cancelled")], mailer.Sent);
    }

    [Fact]
    public void After_MockGatewayFailsImmediatelyOnTheWrongChargeButAcceptsTheRightOne()
    {
        var wrongOrders = new InMemoryOrderRepository(AnOrder(99900));
        var wrongGateway = new MockPaymentGateway(1, 500);
        var wrongUseCase = new TestDoublesAfter.CancelOrder(wrongOrders, wrongGateway, new SpyMailer(), new NullAuditLogger());
        var exception = Assert.Throws<InvalidOperationException>(() => wrongUseCase.Execute(1));
        Assert.Contains("unexpected charge", exception.Message);

        var orders = new InMemoryOrderRepository(AnOrder());
        var gateway = new MockPaymentGateway(1, 500);
        new TestDoublesAfter.CancelOrder(orders, gateway, new SpyMailer(), new NullAuditLogger()).Execute(1);
        Assert.True(gateway.Called);
    }

    [Fact]
    public void After_FakeRepositorySavesTheCancelledOrder()
    {
        var orders = new InMemoryOrderRepository(AnOrder());
        new TestDoublesAfter.CancelOrder(orders, new StubPaymentGateway(TestDoublesAfter.ChargeResult.Approved), new SpyMailer(), new NullAuditLogger()).Execute(1);
        // Real behaviour: a later read reflects what an earlier write saved. If Save were
        // never called, Get would still return the untouched copy stored at construction time.
        Assert.Equal(TestDoublesAfter.OrderStatus.Cancelled, orders.Get(1).Status);
    }
}
