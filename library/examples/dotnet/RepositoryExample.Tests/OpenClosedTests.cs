using OpenClosedBefore = RepositoryExample.OpenClosed.Before;
using OpenClosedAfter = RepositoryExample.OpenClosed.After;
using Xunit;

namespace RepositoryExample.Tests;

public class OpenClosedTests
{
    [Fact]
    public void Before_FeeForAPendingStandardOrderIsFree()
    {
        var order = new OpenClosedBefore.Order(OpenClosedBefore.OrderType.Standard, 100.0, Pending: true);
        Assert.Equal(0.0, new OpenClosedBefore.CancellationFeeCalculator().CalculateFee(order));
    }

    [Fact]
    public void Before_FeeForAShippedStandardOrderIsTheFullAmount()
    {
        var order = new OpenClosedBefore.Order(OpenClosedBefore.OrderType.Standard, 100.0, Pending: false);
        Assert.Equal(100.0, new OpenClosedBefore.CancellationFeeCalculator().CalculateFee(order));
    }

    [Fact]
    public void Before_FeeAndDescriptionForAnExpressOrder()
    {
        var order = new OpenClosedBefore.Order(OpenClosedBefore.OrderType.Express, 100.0);
        Assert.Equal(15.0, new OpenClosedBefore.CancellationFeeCalculator().CalculateFee(order));
        Assert.Equal("Refund minus a flat express handling fee", new OpenClosedBefore.RefundDescription().Describe(order));
    }

    [Fact]
    public void Before_FeeForASubscriptionOrderIsProratedByElapsedMonths()
    {
        var order = new OpenClosedBefore.Order(OpenClosedBefore.OrderType.Subscription, 120.0, MonthsElapsed: 3, TotalMonths: 12);
        Assert.Equal(30.0, new OpenClosedBefore.CancellationFeeCalculator().CalculateFee(order));
    }

    [Fact]
    public void Before_ACustomMadeOrderGetsTheWrongRefundDescriptionDespiteTheRightFee()
    {
        var order = new OpenClosedBefore.Order(OpenClosedBefore.OrderType.CustomMade, 200.0);
        Assert.Equal(100.0, new OpenClosedBefore.CancellationFeeCalculator().CalculateFee(order));
        Assert.Equal("Refund processed", new OpenClosedBefore.RefundDescription().Describe(order));
    }

    [Fact]
    public void After_FeeForAPendingStandardOrderIsFree()
    {
        var order = new OpenClosedAfter.Order(OpenClosedAfter.OrderType.Standard, 100.0, Pending: true);
        Assert.Equal(0.0, new OpenClosedAfter.CancellationFeeCalculator().CalculateFee(order));
    }

    [Fact]
    public void After_FeeForAShippedStandardOrderIsTheFullAmount()
    {
        var order = new OpenClosedAfter.Order(OpenClosedAfter.OrderType.Standard, 100.0, Pending: false);
        Assert.Equal(100.0, new OpenClosedAfter.CancellationFeeCalculator().CalculateFee(order));
    }

    [Fact]
    public void After_FeeAndDescriptionForAnExpressOrder()
    {
        var order = new OpenClosedAfter.Order(OpenClosedAfter.OrderType.Express, 100.0);
        var calculator = new OpenClosedAfter.CancellationFeeCalculator();
        Assert.Equal(15.0, calculator.CalculateFee(order));
        Assert.Equal("Refund minus a flat express handling fee", calculator.DescribeRefund(order));
    }

    [Fact]
    public void After_FeeForASubscriptionOrderIsProratedByElapsedMonths()
    {
        var order = new OpenClosedAfter.Order(OpenClosedAfter.OrderType.Subscription, 120.0, MonthsElapsed: 3, TotalMonths: 12);
        Assert.Equal(30.0, new OpenClosedAfter.CancellationFeeCalculator().CalculateFee(order));
    }

    [Fact]
    public void After_ACustomMadeOrderGetsItsOwnRefundDescription()
    {
        var order = new OpenClosedAfter.Order(OpenClosedAfter.OrderType.CustomMade, 200.0);
        var calculator = new OpenClosedAfter.CancellationFeeCalculator();
        Assert.Equal(100.0, calculator.CalculateFee(order));
        Assert.Equal("50% refund, materials already committed", calculator.DescribeRefund(order));
    }

    // A brand-new order type; no existing policy or calculator file is
    // touched to add it.
    private sealed class GiftFeePolicy : OpenClosedAfter.IFeePolicy
    {
        public double Fee(OpenClosedAfter.Order order) => 0.0;

        public string DescribeRefund(OpenClosedAfter.Order order) => "Full refund, gift orders are always free to cancel";
    }

    [Fact]
    public void After_AddingAGiftPolicyNeedsNoChangeToExistingPolicies()
    {
        var policies = OpenClosedAfter.DefaultPolicies.Create();
        policies["gift"] = new GiftFeePolicy();
        var calculator = new OpenClosedAfter.CancellationFeeCalculator(policies);
        var order = new OpenClosedAfter.Order("gift", 50.0);
        Assert.Equal(0.0, calculator.CalculateFee(order));
        Assert.Equal("Full refund, gift orders are always free to cancel", calculator.DescribeRefund(order));
    }
}
