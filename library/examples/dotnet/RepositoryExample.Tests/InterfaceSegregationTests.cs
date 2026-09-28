using ISAfter = RepositoryExample.InterfaceSegregation.After;
using ISBefore = RepositoryExample.InterfaceSegregation.Before;
using Xunit;

namespace RepositoryExample.Tests;

public class InterfaceSegregationTests
{
    // Implements the fat interface CancelOrder depends on. Get/Save are the only
    // methods CancelOrder calls; the rest exist only to satisfy the contract.
    private class FakeOrderStoreV1 : ISBefore.IOrderStoreV1
    {
        public static readonly string[] UnusedStubs =
            ["Delete", "ListByCustomer", "ExportCsv", "AuditTrail", "PurgeOlderThan"];

        private readonly Dictionary<int, ISBefore.Order> _orders;

        public FakeOrderStoreV1(params ISBefore.Order[] orders) =>
            _orders = orders.ToDictionary(order => order.Id);

        public ISBefore.Order Get(int orderId) => _orders[orderId];

        public void Save(ISBefore.Order order) => _orders[order.Id] = order;

        public void Delete(int orderId) => throw new InvalidOperationException("not used");

        public List<ISBefore.Order> ListByCustomer(string customerEmail) => throw new InvalidOperationException("not used");

        public string ExportCsv() => throw new InvalidOperationException("not used");

        public List<string> AuditTrail(int orderId) => throw new InvalidOperationException("not used");

        public int PurgeOlderThan(int days) => throw new InvalidOperationException("not used");
    }

    // The fat interface grew an eighth member (Archive). CancelOrder's own behaviour
    // is unchanged, but its fake must grow with the interface -- one more unused stub.
    private sealed class FakeOrderStoreV2(params ISBefore.Order[] orders) : FakeOrderStoreV1(orders), ISBefore.IOrderStoreV2
    {
        public static readonly string[] UnusedStubsV2 = [.. UnusedStubs, "Archive"];

        public void Archive(int orderId) => throw new InvalidOperationException("not used");
    }

    [Fact]
    public void Before_CancelOrderWorksButItsFakeStubsFiveUnusedMethods()
    {
        var store = new FakeOrderStoreV1(new ISBefore.Order(1, "ada@example.com", 500));
        new ISBefore.CancelOrder(store).Execute(1);
        Assert.Equal("cancelled", store.Get(1).Status);
        Assert.Equal(5, FakeOrderStoreV1.UnusedStubs.Length);
        Assert.Throws<InvalidOperationException>(() => store.Delete(1));
    }

    [Fact]
    public void Before_GrowingTheFatStoreForcesTheCancelTestFakeToGrowToo()
    {
        var store = new FakeOrderStoreV2(new ISBefore.Order(1, "ada@example.com", 500));
        // Cancel order's own behaviour did not change -- it still only calls Get and Save.
        new ISBefore.CancelOrder(store).Execute(1);
        Assert.Equal("cancelled", store.Get(1).Status);
        // But the fake that satisfies the grown interface needed one more unused stub.
        Assert.Equal(FakeOrderStoreV1.UnusedStubs.Length + 1, FakeOrderStoreV2.UnusedStubsV2.Length);
        Assert.Throws<InvalidOperationException>(() => store.Archive(1));
    }

    // Implements the narrow role interface CancelOrder actually depends on: exactly
    // two methods, both real.
    private sealed class FakeCancelOrderStore : ISAfter.ICancelOrderStore
    {
        public static readonly string[] RealMethods = ["Get", "Save"];

        private readonly Dictionary<int, ISAfter.Order> _orders;

        public FakeCancelOrderStore(params ISAfter.Order[] orders) =>
            _orders = orders.ToDictionary(order => order.Id);

        public ISAfter.Order Get(int orderId) => _orders[orderId];

        public void Save(ISAfter.Order order) => _orders[order.Id] = order;
    }

    [Fact]
    public void After_CancelOrdersFakeHasExactlyTwoMethodsBothReal()
    {
        var store = new FakeCancelOrderStore(new ISAfter.Order(1, "ada@example.com", 500));
        new ISAfter.CancelOrder(store).Execute(1);
        Assert.Equal("cancelled", store.Get(1).Status);
        Assert.Equal(2, FakeCancelOrderStore.RealMethods.Length);
    }

    [Fact]
    public void After_AddingARoleInterfaceForArchivingDoesNotTouchCancelOrderOrItsFake()
    {
        var adapter = new ISAfter.OrderStoreAdapter();
        adapter.Save(new ISAfter.Order(1, "ada@example.com", 500));
        ISAfter.IOrderArchiver archiver = adapter;
        archiver.Archive(1);
        Assert.Equal("archived", adapter.Get(1).Status);
        // CancelOrder and its fake are exactly as declared above -- untouched by the new role.
        var store = new FakeCancelOrderStore(new ISAfter.Order(2, "ada@example.com", 700));
        new ISAfter.CancelOrder(store).Execute(2);
        Assert.Equal("cancelled", store.Get(2).Status);
        Assert.Equal(2, FakeCancelOrderStore.RealMethods.Length);
    }
}
