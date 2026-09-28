namespace RepositoryExample.OpenClosed.Before;

// The same switch, copy-pasted here for the customer-facing message — kept in
// sync for express and subscription, never updated when custom-made orders
// were added.
public sealed class RefundDescription
{
    public string Describe(Order order) => order.Type switch
    {
        OrderType.Standard => order.Pending ? "Full refund, order not yet processed" : "No refund, order already shipped",
        OrderType.Express => "Refund minus a flat express handling fee",
        OrderType.Subscription => "Prorated refund for unused months",
        _ => "Refund processed",
    };
}
