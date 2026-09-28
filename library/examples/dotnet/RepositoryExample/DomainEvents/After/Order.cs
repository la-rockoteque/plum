namespace RepositoryExample.DomainEvents.After;

// Cancel only changes state and records an event; handlers react later.
public sealed class OrderAlreadyCancelledException : Exception
{
    public OrderAlreadyCancelledException(string message) : base(message) { }
}

public sealed class OrderNotFoundException : Exception
{
    public OrderNotFoundException(string message) : base(message) { }
}

public interface IClock
{
    long NowMs();
}

public interface IInventoryService
{
    void Release(int orderId);
}

public interface IMailer
{
    void SendCancellationEmail(int orderId);
}

public interface ILoyaltyLedger
{
    void RecordCancellation(int orderId);
}

// An immutable fact: this happened. Not a request for anything to happen.
public sealed record OrderCancelled(int OrderId, string Reason, long OccurredAtMs);

// The aggregate root: Cancel changes state and records what happened, nothing else.
public sealed class Order
{
    private readonly List<OrderCancelled> _events = new();

    public int Id { get; }
    public string Status { get; private set; } = "pending";

    public Order(int id) => Id = id;

    // A detached copy of the stored state; pending events stay with the original.
    public Order Copy() => new(Id) { Status = Status };

    public void Cancel(string reason, IClock clock)
    {
        if (Status == "cancelled")
        {
            throw new OrderAlreadyCancelledException("order is already cancelled");
        }
        Status = "cancelled";
        _events.Add(new OrderCancelled(Id, reason, clock.NowMs()));
    }

    // Returns the recorded events and clears them, so a dispatch is never repeated.
    public List<OrderCancelled> PullEvents()
    {
        var events = new List<OrderCancelled>(_events);
        _events.Clear();
        return events;
    }
}

public interface IOrderRepository
{
    Order? Get(int orderId);
    void Save(Order order);
}

public class InMemoryOrderRepository : IOrderRepository
{
    private readonly Dictionary<int, Order> _orders = new();

    public Order? Get(int orderId) => _orders.GetValueOrDefault(orderId)?.Copy();

    public void Save(Order order) => _orders[order.Id] = order.Copy();
}

public interface IEventHandler
{
    void Handle(OrderCancelled @event);
}

// A plain list of handlers per event type. No framework, no ordering guarantees beyond registration order.
public sealed class EventDispatcher
{
    private readonly Dictionary<Type, List<IEventHandler>> _handlers = new();

    public void Register(Type eventType, IEventHandler handler)
    {
        if (!_handlers.TryGetValue(eventType, out var list))
        {
            list = new List<IEventHandler>();
            _handlers[eventType] = list;
        }
        list.Add(handler);
    }

    public void Dispatch(List<OrderCancelled> events)
    {
        foreach (var @event in events)
        {
            if (!_handlers.TryGetValue(@event.GetType(), out var list)) continue;
            foreach (var handler in list) handler.Handle(@event);
        }
    }
}

public sealed class ReleaseInventoryHandler : IEventHandler
{
    private readonly IInventoryService _inventory;
    public ReleaseInventoryHandler(IInventoryService inventory) => _inventory = inventory;
    public void Handle(OrderCancelled @event) => _inventory.Release(@event.OrderId);
}

public sealed class SendCancellationEmailHandler : IEventHandler
{
    private readonly IMailer _mailer;
    public SendCancellationEmailHandler(IMailer mailer) => _mailer = mailer;
    public void Handle(OrderCancelled @event) => _mailer.SendCancellationEmail(@event.OrderId);
}

public sealed class RecordLoyaltyCancellationHandler : IEventHandler
{
    private readonly ILoyaltyLedger _loyalty;
    public RecordLoyaltyCancellationHandler(ILoyaltyLedger loyalty) => _loyalty = loyalty;
    public void Handle(OrderCancelled @event) => _loyalty.RecordCancellation(@event.OrderId);
}

// The application service: save the aggregate, then dispatch what it recorded.
public sealed class CancelOrderService
{
    private readonly IOrderRepository _repo;
    private readonly EventDispatcher _dispatcher;
    private readonly IClock _clock;

    public CancelOrderService(IOrderRepository repo, EventDispatcher dispatcher, IClock clock)
    {
        _repo = repo;
        _dispatcher = dispatcher;
        _clock = clock;
    }

    public void Cancel(int orderId, string reason)
    {
        var order = _repo.Get(orderId) ?? throw new OrderNotFoundException($"no such order: {orderId}");
        order.Cancel(reason, _clock);
        _repo.Save(order);
        _dispatcher.Dispatch(order.PullEvents());
    }
}
