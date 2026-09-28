using Xunit;
using LawOfDemeterBefore = RepositoryExample.LawOfDemeter.Before;
using LawOfDemeterAfter = RepositoryExample.LawOfDemeter.After;

namespace RepositoryExample.Tests;

public class LawOfDemeterTests
{
    [Fact]
    public void Before_RefundAndCustomsDecisionsWalkTheCustomersAddressDirectlyForOrdinaryAddresses()
    {
        var cancellation = new LawOfDemeterBefore.CancellationPolicy();
        var labels = new LawOfDemeterBefore.ReturnLabelPrinter();

        var domestic = new LawOfDemeterBefore.Order
        {
            Customer = new LawOfDemeterBefore.Customer
            {
                Address = new LawOfDemeterBefore.Address { Country = new LawOfDemeterBefore.Country { Code = "US" } },
            },
        };
        Assert.True(cancellation.CanAutoRefund(domestic));
        Assert.False(labels.NeedsCustomsForm(domestic));

        var foreign = new LawOfDemeterBefore.Order
        {
            Customer = new LawOfDemeterBefore.Customer
            {
                Address = new LawOfDemeterBefore.Address { Country = new LawOfDemeterBefore.Country { Code = "CA" } },
            },
        };
        Assert.False(cancellation.CanAutoRefund(foreign));
        Assert.True(labels.NeedsCustomsForm(foreign));
    }

    [Fact]
    public void Before_ARegionMigratedDomesticAddressIsWronglyTreatedAsNonDomesticByBothDistantCallers()
    {
        var cancellation = new LawOfDemeterBefore.CancellationPolicy();
        var labels = new LawOfDemeterBefore.ReturnLabelPrinter();

        var migratedDomestic = new LawOfDemeterBefore.Order
        {
            Customer = new LawOfDemeterBefore.Customer
            {
                Address = new LawOfDemeterBefore.Address
                {
                    Region = new LawOfDemeterBefore.Region { Country = new LawOfDemeterBefore.Country { Code = "US" } },
                },
            },
        };
        // Both callers still only know how to read Address.Country; neither has been taught
        // about Region, so both get the same, wrong, conservative answer.
        Assert.False(cancellation.CanAutoRefund(migratedDomestic));
        Assert.True(labels.NeedsCustomsForm(migratedDomestic));
    }

    [Fact]
    public void After_OrderAsksItsCustomerForTheSameRefundAndCustomsDecisions()
    {
        var cancellation = new LawOfDemeterAfter.CancellationPolicy();
        var labels = new LawOfDemeterAfter.ReturnLabelPrinter();

        var domestic = new LawOfDemeterAfter.Order
        {
            Customer = new LawOfDemeterAfter.Customer
            {
                Address = new LawOfDemeterAfter.Address { Country = new LawOfDemeterAfter.Country { Code = "US" } },
            },
        };
        Assert.True(cancellation.CanAutoRefund(domestic));
        Assert.False(labels.NeedsCustomsForm(domestic));

        var foreign = new LawOfDemeterAfter.Order
        {
            Customer = new LawOfDemeterAfter.Customer
            {
                Address = new LawOfDemeterAfter.Address { Country = new LawOfDemeterAfter.Country { Code = "CA" } },
            },
        };
        Assert.False(cancellation.CanAutoRefund(foreign));
        Assert.True(labels.NeedsCustomsForm(foreign));
    }

    [Fact]
    public void After_TheSameCallerCodeAnswersCorrectlyOnceAddressOwnsTheRegionMigratedShape()
    {
        var cancellation = new LawOfDemeterAfter.CancellationPolicy();
        var labels = new LawOfDemeterAfter.ReturnLabelPrinter();

        var migratedDomestic = new LawOfDemeterAfter.Order
        {
            Customer = new LawOfDemeterAfter.Customer
            {
                Address = new LawOfDemeterAfter.Address
                {
                    Region = new LawOfDemeterAfter.Region { Country = new LawOfDemeterAfter.Country { Code = "US" } },
                },
            },
        };
        Assert.True(cancellation.CanAutoRefund(migratedDomestic));
        Assert.False(labels.NeedsCustomsForm(migratedDomestic));
    }

    [Fact]
    public void After_APickupPointAddressWithNoCountryOrRegionIsTreatedAsNonDomesticWithoutCrashing()
    {
        var cancellation = new LawOfDemeterAfter.CancellationPolicy();
        var labels = new LawOfDemeterAfter.ReturnLabelPrinter();

        var pickupPoint = new LawOfDemeterAfter.Order
        {
            Customer = new LawOfDemeterAfter.Customer
            {
                Address = new LawOfDemeterAfter.Address(),
            },
        };
        Assert.False(cancellation.CanAutoRefund(pickupPoint));
        Assert.True(labels.NeedsCustomsForm(pickupPoint));
    }
}
