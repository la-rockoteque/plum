using System.Reflection;
using RepositoryExample.TestingThroughPublicApi;
using Xunit;

namespace RepositoryExample.Tests;

public class TestingThroughPublicApiTests
{
    private const BindingFlags Private = BindingFlags.NonPublic | BindingFlags.Instance;

    // Fake: real find/save behaviour, no external system.
    private sealed class InMemoryOrderRepository : IOrderRepository
    {
        private readonly Dictionary<string, Order> _orders;

        public InMemoryOrderRepository(params Order[] orders) => _orders = orders.ToDictionary(order => order.Id);

        public Order FindById(string orderId) => _orders[orderId];

        public void Save(Order order) => _orders[order.Id] = order;
    }

    // Spy: records what was sent so the test can assert afterwards.
    private sealed class SpyNotifier : INotifier
    {
        public List<string> Sent { get; } = [];

        public void Send(string message) => Sent.Add(message);
    }

    // A hand-rolled double for the service's OWN internal collaborator - not a port.
    private sealed class MockNotificationFormatter : INotificationFormatter
    {
        public string? CalledOrderId { get; private set; }
        public decimal CalledRefundAmount { get; private set; }

        public string Format(string orderId, decimal refundAmount)
        {
            CalledOrderId = orderId;
            CalledRefundAmount = refundAmount;
            return "mocked notification";
        }
    }

    private static Order AnOrder() => new("order-1", 50.0m);

    // --- before: internal-poking tests, via reflection since C# private is truly private -------

    [Fact]
    public void Before_PokingThePrivateFeeHelperAndFieldPassesAgainstThePreRefactorImplementation()
    {
        var order = AnOrder();
        var service = new PreRefactorService(new InMemoryOrderRepository(order), new SpyNotifier());
        var type = typeof(PreRefactorService);

        // Reach past Cancel() and call the private helper directly.
        var calculateFee = type.GetMethod("CalculateFee", Private)!;
        var fee = (decimal)calculateFee.Invoke(service, [order])!;
        Assert.Equal(5.0m, fee);

        // Assert on a private field instead of an observable outcome.
        var feeRateField = type.GetField("_feeRate", Private)!;
        Assert.Equal(0.1m, (decimal)feeRateField.GetValue(service)!);
    }

    [Fact]
    public void Before_MockingTheServicesOwnFormatterPassesButCouplesTheTestToImplementation()
    {
        var order = AnOrder();
        var service = new PreRefactorService(new InMemoryOrderRepository(order), new SpyNotifier());
        var mock = new MockNotificationFormatter();

        // Reach in and replace a collaborator the service built for itself.
        var formatterField = typeof(PreRefactorService).GetField("_formatter", Private)!;
        formatterField.SetValue(service, mock);

        service.Cancel("order-1");

        Assert.Equal("order-1", mock.CalledOrderId);
        Assert.Equal(45.0m, mock.CalledRefundAmount);
    }

    [Fact]
    public void Before_TheSamePrivatePokingAssertionsNoLongerHoldAfterAPureRefactor()
    {
        var service = new PostRefactorService(new InMemoryOrderRepository(AnOrder()), new SpyNotifier());
        var type = typeof(PostRefactorService);

        // The helper the pre-refactor test called directly is gone: inlined into Cancel().
        Assert.Null(type.GetMethod("CalculateFee", Private));

        // The field the pre-refactor test asserted on directly was renamed.
        Assert.Null(type.GetField("_feeRate", Private));
        var renamedField = type.GetField("_cancellationFeeRate", Private)!;
        Assert.Equal(0.1m, (decimal)renamedField.GetValue(service)!);
    }

    // --- after: public-API tests, run unmodified against both implementations -------------------

    private static void AssertCancellingOrder1BehavesCorrectly(
        Func<string, CancellationOutcome> cancel, InMemoryOrderRepository orders, SpyNotifier notifier)
    {
        var outcome = cancel("order-1");
        Assert.Equal("order-1", outcome.OrderId);
        Assert.Equal(45.0m, outcome.RefundAmount);
        Assert.Equal("cancelled", outcome.Status);

        // Observable via the fake repository: state was actually persisted.
        Assert.Equal("cancelled", orders.FindById("order-1").Status);

        // Observable via the notifier spy: the right message was sent.
        Assert.Equal(["Order order-1 cancelled; refund 45.00"], notifier.Sent);
    }

    [Fact]
    public void After_CancellingThroughThePublicApiBehavesIdenticallyAgainstThePreRefactorImplementation()
    {
        var orders = new InMemoryOrderRepository(AnOrder());
        var notifier = new SpyNotifier();
        var service = new PreRefactorService(orders, notifier);
        AssertCancellingOrder1BehavesCorrectly(service.Cancel, orders, notifier);
    }

    [Fact]
    public void After_CancellingThroughThePublicApiBehavesIdenticallyAgainstThePostRefactorImplementation()
    {
        var orders = new InMemoryOrderRepository(AnOrder());
        var notifier = new SpyNotifier();
        var service = new PostRefactorService(orders, notifier);
        AssertCancellingOrder1BehavesCorrectly(service.Cancel, orders, notifier);
    }
}
