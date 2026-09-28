using LegacyOrder = RepositoryExample.CharacterizationTests.Legacy.Order;
using LegacyRefundCalculator = RepositoryExample.CharacterizationTests.Legacy.RefundCalculator;
using RefactoredOrder = RepositoryExample.CharacterizationTests.Refactored.Order;
using RefactoredRefundCalculator = RepositoryExample.CharacterizationTests.Refactored.RefundCalculator;
using Xunit;

namespace RepositoryExample.Tests;

public class CharacterizationTestsTests
{
    private const long MsPerDay = 24 * 60 * 60 * 1000;
    private const long TodayMs = 1_700_000_000_000;

    [Fact]
    public void Before_NobodyKnowsWhatComputeRefundDoesForMostInputs()
    {
        // The starting point of legacy work: one sample input pinned, nothing more understood yet.
        var order = new LegacyOrder { OrderId = 1, AmountMinor = 10_000, PurchasedAtMs = TodayMs - 5 * MsPerDay, Status = "active" };
        Assert.Equal(10_000, LegacyRefundCalculator.ComputeRefund(order, TodayMs));
    }

    [Fact]
    public void Currently_AHoldOrderRefundsZeroRegardlessOfAge()
    {
        var legacy = new LegacyOrder { OrderId = 2, AmountMinor = 10_000, PurchasedAtMs = TodayMs - 5 * MsPerDay, Status = "hold" };
        var refactored = new RefactoredOrder { OrderId = 2, AmountMinor = 10_000, PurchasedAtMs = TodayMs - 5 * MsPerDay, Status = "hold" };
        Assert.Equal(0, LegacyRefundCalculator.ComputeRefund(legacy, TodayMs));
        Assert.Equal(0, RefactoredRefundCalculator.ComputeRefund(refactored, TodayMs));
    }

    [Fact]
    public void Currently_AnOrderExactly14DaysOldGetsAFullRefund()
    {
        var legacy = new LegacyOrder { OrderId = 3, AmountMinor = 10_000, PurchasedAtMs = TodayMs - 14 * MsPerDay, Status = "active" };
        var refactored = new RefactoredOrder { OrderId = 3, AmountMinor = 10_000, PurchasedAtMs = TodayMs - 14 * MsPerDay, Status = "active" };
        Assert.Equal(10_000, LegacyRefundCalculator.ComputeRefund(legacy, TodayMs));
        Assert.Equal(10_000, RefactoredRefundCalculator.ComputeRefund(refactored, TodayMs));
    }

    [Fact]
    public void Currently_AnOrder15DaysOldRefunds90Percent()
    {
        var legacy = new LegacyOrder { OrderId = 4, AmountMinor = 10_000, PurchasedAtMs = TodayMs - 15 * MsPerDay, Status = "active" };
        var refactored = new RefactoredOrder { OrderId = 4, AmountMinor = 10_000, PurchasedAtMs = TodayMs - 15 * MsPerDay, Status = "active" };
        Assert.Equal(9_000, LegacyRefundCalculator.ComputeRefund(legacy, TodayMs));
        Assert.Equal(9_000, RefactoredRefundCalculator.ComputeRefund(refactored, TodayMs));
    }

    [Fact]
    public void Currently_AnOrderExactly30DaysOldIsNotRoundedDown()
    {
        var legacy = new LegacyOrder { OrderId = 5, AmountMinor = 10_050, PurchasedAtMs = TodayMs - 30 * MsPerDay, Status = "active" };
        var refactored = new RefactoredOrder { OrderId = 5, AmountMinor = 10_050, PurchasedAtMs = TodayMs - 30 * MsPerDay, Status = "active" };
        Assert.Equal(9_045, LegacyRefundCalculator.ComputeRefund(legacy, TodayMs));
        Assert.Equal(9_045, RefactoredRefundCalculator.ComputeRefund(refactored, TodayMs));
    }

    [Fact]
    public void Currently_AnOrderOlderThan30DaysRoundsTheRefundDownToTheNearestHundred()
    {
        var legacy = new LegacyOrder { OrderId = 6, AmountMinor = 10_050, PurchasedAtMs = TodayMs - 31 * MsPerDay, Status = "active" };
        var refactored = new RefactoredOrder { OrderId = 6, AmountMinor = 10_050, PurchasedAtMs = TodayMs - 31 * MsPerDay, Status = "active" };
        Assert.Equal(9_000, LegacyRefundCalculator.ComputeRefund(legacy, TodayMs));
        Assert.Equal(9_000, RefactoredRefundCalculator.ComputeRefund(refactored, TodayMs));
    }
}
