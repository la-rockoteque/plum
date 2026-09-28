using Xunit;
using LawOfDemeterBefore = RepositoryExample.LawOfDemeter.Before;
using LawOfDemeterAfter = RepositoryExample.LawOfDemeter.After;

namespace RepositoryExample.Tests;

public class LawOfDemeterTests
{
    [Fact]
    public void Before_ShippingAndRefundDecisionsWalkTheCustomersAddressAndWalletDirectly()
    {
        var policy = new LawOfDemeterBefore.CancellationPolicy();

        var domestic = new LawOfDemeterBefore.Order
        {
            Customer = new LawOfDemeterBefore.Customer
            {
                Address = new LawOfDemeterBefore.Address { Country = new LawOfDemeterBefore.Country { Code = "US" } },
                Wallet = new LawOfDemeterBefore.Wallet { Card = new LawOfDemeterBefore.Card { Expired = false } },
            },
        };
        Assert.True(policy.ShipsDomestically(domestic));
        Assert.True(policy.CanAutoRefund(domestic));

        var foreign = new LawOfDemeterBefore.Order
        {
            Customer = new LawOfDemeterBefore.Customer
            {
                Address = new LawOfDemeterBefore.Address { Country = new LawOfDemeterBefore.Country { Code = "CA" } },
                Wallet = new LawOfDemeterBefore.Wallet { Card = new LawOfDemeterBefore.Card { Expired = true } },
            },
        };
        Assert.False(policy.ShipsDomestically(foreign));
        Assert.False(policy.CanAutoRefund(foreign));
    }

    [Fact]
    public void Before_APickupPointAddressWithoutACountryBreaksTheShippingCheck()
    {
        var policy = new LawOfDemeterBefore.CancellationPolicy();
        var order = new LawOfDemeterBefore.Order
        {
            Customer = new LawOfDemeterBefore.Customer
            {
                Address = new LawOfDemeterBefore.Address { Country = null },
                Wallet = new LawOfDemeterBefore.Wallet { Card = new LawOfDemeterBefore.Card { Expired = false } },
            },
        };
        Assert.Throws<NullReferenceException>(() => policy.ShipsDomestically(order));
    }

    [Fact]
    public void After_OrderAsksItsCustomerWhoAsksItsOwnCollaboratorsForTheSameDecisions()
    {
        var policy = new LawOfDemeterAfter.CancellationPolicy();

        var domestic = new LawOfDemeterAfter.Order
        {
            Customer = new LawOfDemeterAfter.Customer
            {
                Address = new LawOfDemeterAfter.Address { Country = new LawOfDemeterAfter.Country { Code = "US" } },
                Wallet = new LawOfDemeterAfter.Wallet { Card = new LawOfDemeterAfter.Card { Expired = false } },
            },
        };
        Assert.True(policy.ShipsDomestically(domestic));
        Assert.True(policy.CanAutoRefund(domestic));

        var foreign = new LawOfDemeterAfter.Order
        {
            Customer = new LawOfDemeterAfter.Customer
            {
                Address = new LawOfDemeterAfter.Address { Country = new LawOfDemeterAfter.Country { Code = "CA" } },
                Wallet = new LawOfDemeterAfter.Wallet { Card = new LawOfDemeterAfter.Card { Expired = true } },
            },
        };
        Assert.False(policy.ShipsDomestically(foreign));
        Assert.False(policy.CanAutoRefund(foreign));
    }

    [Fact]
    public void After_APickupPointAddressWithoutACountryNoLongerBreaksTheShippingCheck()
    {
        var policy = new LawOfDemeterAfter.CancellationPolicy();
        var order = new LawOfDemeterAfter.Order
        {
            Customer = new LawOfDemeterAfter.Customer
            {
                Address = new LawOfDemeterAfter.Address { Country = null },
                Wallet = new LawOfDemeterAfter.Wallet { Card = new LawOfDemeterAfter.Card { Expired = false } },
            },
        };
        Assert.False(policy.ShipsDomestically(order));
        Assert.True(policy.CanAutoRefund(order));
    }
}
