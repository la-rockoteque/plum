using TestDoublesAfter = RepositoryExample.TestDoubles.After;
using TestDoublesBefore = RepositoryExample.TestDoubles.Before;
using Xunit;

namespace RepositoryExample.Tests;

public class TestDoublesTests
{
    [Fact]
    public void Before_CancellingAnOrderBlowsUpInsteadOfCompleting()
    {
        var order = new TestDoublesBefore.Order("order-1", "ada@example.com", 5.0m);
        var exception = Assert.Throws<InvalidOperationException>(() => new TestDoublesBefore.CancelOrder().Execute(order));
        Assert.Contains("network unavailable", exception.Message);
        // Nothing about the business outcome is observable: the order never even changed status.
        Assert.Equal("placed", order.Status);
    }

    // Dummy: satisfies the constructor. If a test ever asserted on this, it wouldn't be a dummy anymore.
    private sealed class NullAuditLogger : TestDoublesAfter.IAuditLogger
    {
        public void Log(string message) => throw new InvalidOperationException("dummy should never be called");
    }

    // Fake: real find/save behaviour, no external system.
    private sealed class InMemoryOrderRepository : TestDoublesAfter.IOrderRepository
    {
        private readonly Dictionary<string, TestDoublesAfter.Order> _orders;

        public InMemoryOrderRepository(params TestDoublesAfter.Order[] orders) =>
            _orders = orders.ToDictionary(order => order.Id);

        public TestDoublesAfter.Order FindById(string orderId) => _orders[orderId];

        public void Save(TestDoublesAfter.Order order) => _orders[order.Id] = order;
    }

    // Stub: a canned response. Nothing is recorded, nothing is verified.
    private sealed class StubPaymentGateway : TestDoublesAfter.IPaymentGateway
    {
        public void Charge(string orderId, decimal amount)
        {
        }
    }

    // Mock: a hand-rolled expectation. The wrong call fails immediately; the right one is recorded.
    private sealed class MockPaymentGateway(string expectedOrderId, decimal expectedAmount) : TestDoublesAfter.IPaymentGateway
    {
        public bool Called { get; private set; }

        public void Charge(string orderId, decimal amount)
        {
            if (orderId != expectedOrderId || amount != expectedAmount)
            {
                throw new InvalidOperationException($"unexpected charge: {orderId} {amount}");
            }
            Called = true;
        }
    }

    // Spy: records what was sent so the test can assert afterwards (state verification).
    private sealed class SpyMailer : TestDoublesAfter.IMailer
    {
        public List<(string To, string Message)> Sent { get; } = [];

        public void Send(string to, string message) => Sent.Add((to, message));
    }

    private static TestDoublesAfter.Order AnOrder(decimal fee = 5.0m) =>
        new("order-1", "ada@example.com", fee);

    [Fact]
    public void After_DummyAuditLoggerIsPassedButNeverCalled()
    {
        var orders = new InMemoryOrderRepository(AnOrder());
        var useCase = new TestDoublesAfter.CancelOrder(orders, new StubPaymentGateway(), new SpyMailer(), new NullAuditLogger());
        useCase.Execute("order-1"); // would throw if the dummy were ever invoked
    }

    [Fact]
    public void After_StubGatewayReturnsACannedChargeResult()
    {
        var orders = new InMemoryOrderRepository(AnOrder());
        var mailer = new SpyMailer();
        new TestDoublesAfter.CancelOrder(orders, new StubPaymentGateway(), mailer, new NullAuditLogger()).Execute("order-1");
        // The stub's canned response is enough to let the use case reach the mailer.
        Assert.NotEmpty(mailer.Sent);
    }

    [Fact]
    public void After_SpyMailerRecordsTheMessageItSent()
    {
        var orders = new InMemoryOrderRepository(AnOrder());
        var mailer = new SpyMailer();
        new TestDoublesAfter.CancelOrder(orders, new StubPaymentGateway(), mailer, new NullAuditLogger()).Execute("order-1");
        Assert.Equal([("ada@example.com", "Your order order-1 was cancelled")], mailer.Sent);
    }

    [Fact]
    public void After_MockGatewayAcceptsTheExpectedCharge()
    {
        var orders = new InMemoryOrderRepository(AnOrder());
        var gateway = new MockPaymentGateway("order-1", 5.0m);
        new TestDoublesAfter.CancelOrder(orders, gateway, new SpyMailer(), new NullAuditLogger()).Execute("order-1");
        Assert.True(gateway.Called);
    }

    [Fact]
    public void After_MockGatewayRejectsAnUnexpectedAmount()
    {
        var orders = new InMemoryOrderRepository(AnOrder(999.0m));
        var gateway = new MockPaymentGateway("order-1", 5.0m);
        var useCase = new TestDoublesAfter.CancelOrder(orders, gateway, new SpyMailer(), new NullAuditLogger());
        var exception = Assert.Throws<InvalidOperationException>(() => useCase.Execute("order-1"));
        Assert.Contains("unexpected charge", exception.Message);
    }

    [Fact]
    public void After_FakeRepositorySavesTheCancelledOrder()
    {
        var orders = new InMemoryOrderRepository(AnOrder());
        new TestDoublesAfter.CancelOrder(orders, new StubPaymentGateway(), new SpyMailer(), new NullAuditLogger()).Execute("order-1");
        // Real behaviour: a later read reflects what an earlier write saved.
        Assert.Equal("cancelled", orders.FindById("order-1").Status);
    }
}
