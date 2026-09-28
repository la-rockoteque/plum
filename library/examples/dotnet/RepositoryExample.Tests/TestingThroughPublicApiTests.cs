using System.Reflection;
using RepositoryExample.TestingThroughPublicApi;
using Xunit;

namespace RepositoryExample.Tests;

public class TestingThroughPublicApiTests
{
    private const BindingFlags Private = BindingFlags.NonPublic | BindingFlags.Instance;

    private static Order CloneOrder(Order order) => new(order.Id, order.AmountMinor) { Status = order.Status };

    // Fake: real find/save behaviour, no external system. Copies on write and read, so a caller
    // can't observe state through a reference it never went through the repository for.
    private sealed class InMemoryOrderRepository : IOrderRepository
    {
        private readonly Dictionary<int, Order> _orders;

        public InMemoryOrderRepository(params Order[] orders) =>
            _orders = orders.ToDictionary(order => order.Id, CloneOrder);

        public Order FindById(int orderId) => CloneOrder(_orders[orderId]);

        public void Save(Order order) => _orders[order.Id] = CloneOrder(order);
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
        public int? CalledOrderId { get; private set; }
        public int CalledRefundAmountMinor { get; private set; }

        public string Format(int orderId, int refundAmountMinor)
        {
            CalledOrderId = orderId;
            CalledRefundAmountMinor = refundAmountMinor;
            return "mocked notification";
        }
    }

    private static Order AnOrder() => new(1, 5000);

    // --- before: internal-poking tests, via reflection since C# private is truly private -------

    [Fact]
    public void Before_PokingThePrivateFeeHelperAndFieldPassesAgainstThePreRefactorImplementation()
    {
        var order = AnOrder();
        var service = new PreRefactorService(new InMemoryOrderRepository(order), new SpyNotifier());
        var type = typeof(PreRefactorService);

        // Reach past Cancel() and call the private helper directly.
        var calculateFee = type.GetMethod("CalculateFee", Private)!;
        var fee = (int)calculateFee.Invoke(service, [order])!;
        Assert.Equal(500, fee);

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

        service.Cancel(1);

        Assert.Equal(1, mock.CalledOrderId);
        Assert.Equal(4500, mock.CalledRefundAmountMinor);
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
        Func<int, CancellationOutcome> cancel, InMemoryOrderRepository orders, SpyNotifier notifier)
    {
        var outcome = cancel(1);
        Assert.Equal(1, outcome.OrderId);
        Assert.Equal(4500, outcome.RefundAmountMinor);
        Assert.Equal(OrderStatus.Cancelled, outcome.Status);

        // Observable via the fake repository: state was actually persisted.
        Assert.Equal(OrderStatus.Cancelled, orders.FindById(1).Status);

        // Observable via the notifier spy: the right message was sent.
        Assert.Equal(["Order 1 cancelled; refund 4500"], notifier.Sent);
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
