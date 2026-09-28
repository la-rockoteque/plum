using Xunit;
using CouplingCohesionBefore = RepositoryExample.CouplingCohesion.Before;
using CouplingCohesionAfter = RepositoryExample.CouplingCohesion.After;

namespace RepositoryExample.Tests;

public class CouplingCohesionTests
{
    [Fact]
    public void Before_CancellationFeeAndLoyaltyDiscountReadTheCustomersFieldsDirectly()
    {
        var gold = new CouplingCohesionBefore.Customer { Tier = "gold", LifetimeSpendMinor = 50_000, YearsAsMember = 1 };
        var order = new CouplingCohesionBefore.Order { AmountMinor = 10_000, Customer = gold };
        var service = new CouplingCohesionBefore.OrderService();
        Assert.Equal(8_000, service.CancellationFee(order));
        Assert.Equal(2000, service.LoyaltyDiscount(gold));

        var bigSpender = new CouplingCohesionBefore.Customer { Tier = "bronze", LifetimeSpendMinor = 150_000, YearsAsMember = 0 };
        Assert.Equal(1000, service.LoyaltyDiscount(bigSpender));
    }

    [Fact]
    public void Before_AMigratedCustomerRepresentationNeedsItsOwnOrderServiceMethod()
    {
        var migrated = new CouplingCohesionBefore.MigratedCustomer
        {
            Tier = CouplingCohesionBefore.LoyaltyTier.Gold,
            LifetimeSpendMinor = 50_000,
            YearsAsMember = 1,
        };
        var service = new CouplingCohesionBefore.OrderService();
        // Customer's tier became a value type; OrderService had to gain a whole new method to
        // read it - the change cost of reaching into Customer's representation instead of asking.
        Assert.Equal(2000, service.MigratedLoyaltyDiscount(migrated));
    }

    [Fact]
    public void After_CancellationFeeAsksTheCustomerForItsOwnDiscount()
    {
        var gold = new CouplingCohesionAfter.Customer { Tier = "gold", LifetimeSpendMinor = 50_000, YearsAsMember = 1 };
        var order = new CouplingCohesionAfter.Order { AmountMinor = 10_000, Customer = gold };
        var service = new CouplingCohesionAfter.OrderService();
        Assert.Equal(8_000, service.CancellationFee(order));
        Assert.Equal(2000, service.LoyaltyDiscount(gold));

        var bigSpender = new CouplingCohesionAfter.Customer { Tier = "bronze", LifetimeSpendMinor = 150_000, YearsAsMember = 0 };
        Assert.Equal(1000, service.LoyaltyDiscount(bigSpender));
    }

    [Fact]
    public void After_OrderServiceNeedsNoChangesForAMigratedCustomerRepresentation()
    {
        var migrated = new CouplingCohesionAfter.MigratedCustomer
        {
            Tier = CouplingCohesionAfter.LoyaltyTier.Gold,
            LifetimeSpendMinor = 50_000,
            YearsAsMember = 1,
        };
        var order = new CouplingCohesionAfter.Order { AmountMinor = 10_000, Customer = migrated };
        var service = new CouplingCohesionAfter.OrderService();
        // Same OrderService code, unedited, gives the same answer for the new representation.
        Assert.Equal(8_000, service.CancellationFee(order));
        Assert.Equal(2000, service.LoyaltyDiscount(migrated));
    }
}
