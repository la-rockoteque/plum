using Xunit;
using CouplingCohesionBefore = RepositoryExample.CouplingCohesion.Before;
using CouplingCohesionAfter = RepositoryExample.CouplingCohesion.After;

namespace RepositoryExample.Tests;

public class CouplingCohesionTests
{
    [Fact]
    public void Before_CancellationFeeReadsTheCustomersTierAndSpendDirectly()
    {
        var customer = new CouplingCohesionBefore.Customer { Tier = "gold", LifetimeSpend = 500, YearsAsMember = 1 };
        var order = new CouplingCohesionBefore.Order { Amount = 100, Customer = customer };
        var service = new CouplingCohesionBefore.OrderService();
        Assert.Equal(75.0, service.CancellationFee(order));
        Assert.Equal(0.25, service.LoyaltyDiscount(customer));
    }

    [Fact]
    public void Before_CancellationFeeAndLoyaltyDiscountDisagreeAtTheSpendBoundary()
    {
        var customer = new CouplingCohesionBefore.Customer { Tier = "bronze", LifetimeSpend = 1000, YearsAsMember = 0 };
        var order = new CouplingCohesionBefore.Order { Amount = 200, Customer = customer };
        var service = new CouplingCohesionBefore.OrderService();
        Assert.Equal(175.0, service.CancellationFee(order)); // 12.5% discount applied
        Assert.Equal(0.0, service.LoyaltyDiscount(customer)); // same customer, no discount at all
    }

    [Fact]
    public void After_CancellationFeeAsksTheCustomerForItsOwnDiscount()
    {
        var customer = new CouplingCohesionAfter.Customer { Tier = "gold", LifetimeSpend = 500, YearsAsMember = 1 };
        var order = new CouplingCohesionAfter.Order { Amount = 100, Customer = customer };
        var service = new CouplingCohesionAfter.OrderService();
        Assert.Equal(75.0, service.CancellationFee(order));
        Assert.Equal(0.25, service.LoyaltyDiscount(customer));
    }

    [Fact]
    public void After_CancellationFeeAndLoyaltyDiscountAgreeAtTheSpendBoundary()
    {
        var customer = new CouplingCohesionAfter.Customer { Tier = "bronze", LifetimeSpend = 1000, YearsAsMember = 0 };
        var order = new CouplingCohesionAfter.Order { Amount = 200, Customer = customer };
        var service = new CouplingCohesionAfter.OrderService();
        Assert.Equal(175.0, service.CancellationFee(order));
        Assert.Equal(0.125, service.LoyaltyDiscount(customer));
    }
}
