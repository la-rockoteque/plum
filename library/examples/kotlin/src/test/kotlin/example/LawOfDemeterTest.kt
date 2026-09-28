package example

import example.lawofdemeter.after.Address as AfterAddress
import example.lawofdemeter.after.CancellationPolicy as AfterCancellationPolicy
import example.lawofdemeter.after.Country as AfterCountry
import example.lawofdemeter.after.Customer as AfterCustomer
import example.lawofdemeter.after.Order as AfterOrder
import example.lawofdemeter.after.Region as AfterRegion
import example.lawofdemeter.after.ReturnLabelPrinter as AfterReturnLabelPrinter
import example.lawofdemeter.before.Address as BeforeAddress
import example.lawofdemeter.before.CancellationPolicy as BeforeCancellationPolicy
import example.lawofdemeter.before.Country as BeforeCountry
import example.lawofdemeter.before.Customer as BeforeCustomer
import example.lawofdemeter.before.Order as BeforeOrder
import example.lawofdemeter.before.Region as BeforeRegion
import example.lawofdemeter.before.ReturnLabelPrinter as BeforeReturnLabelPrinter
import kotlin.test.Test
import kotlin.test.assertEquals

class LawOfDemeterTest {
    @Test
    fun `before - refund and customs decisions walk the customers address directly for ordinary addresses`() {
        val cancellation = BeforeCancellationPolicy()
        val labels = BeforeReturnLabelPrinter()

        val domestic = BeforeOrder(BeforeCustomer(BeforeAddress(country = BeforeCountry("US"), region = null)))
        assertEquals(true, cancellation.canAutoRefund(domestic))
        assertEquals(false, labels.needsCustomsForm(domestic))

        val foreign = BeforeOrder(BeforeCustomer(BeforeAddress(country = BeforeCountry("CA"), region = null)))
        assertEquals(false, cancellation.canAutoRefund(foreign))
        assertEquals(true, labels.needsCustomsForm(foreign))
    }

    @Test
    fun `before - a region-migrated domestic address is wrongly treated as non-domestic by both distant callers`() {
        val cancellation = BeforeCancellationPolicy()
        val labels = BeforeReturnLabelPrinter()

        val migratedDomestic = BeforeOrder(
            BeforeCustomer(BeforeAddress(country = null, region = BeforeRegion(BeforeCountry("US"))))
        )
        // Both callers still only know how to read `address.country`; neither has been taught
        // about `region`, so both get the same, wrong, conservative answer.
        assertEquals(false, cancellation.canAutoRefund(migratedDomestic))
        assertEquals(true, labels.needsCustomsForm(migratedDomestic))
    }

    @Test
    fun `after - order asks its customer for the same refund and customs decisions`() {
        val cancellation = AfterCancellationPolicy()
        val labels = AfterReturnLabelPrinter()

        val domestic = AfterOrder(AfterCustomer(AfterAddress(country = AfterCountry("US"), region = null)))
        assertEquals(true, cancellation.canAutoRefund(domestic))
        assertEquals(false, labels.needsCustomsForm(domestic))

        val foreign = AfterOrder(AfterCustomer(AfterAddress(country = AfterCountry("CA"), region = null)))
        assertEquals(false, cancellation.canAutoRefund(foreign))
        assertEquals(true, labels.needsCustomsForm(foreign))
    }

    @Test
    fun `after - the same caller code answers correctly once address owns the region-migrated shape`() {
        val cancellation = AfterCancellationPolicy()
        val labels = AfterReturnLabelPrinter()

        val migratedDomestic = AfterOrder(
            AfterCustomer(AfterAddress(country = null, region = AfterRegion(AfterCountry("US"))))
        )
        assertEquals(true, cancellation.canAutoRefund(migratedDomestic))
        assertEquals(false, labels.needsCustomsForm(migratedDomestic))
    }

    @Test
    fun `after - a pickup point address with no country or region is treated as non-domestic without crashing`() {
        val cancellation = AfterCancellationPolicy()
        val labels = AfterReturnLabelPrinter()

        val pickupPoint = AfterOrder(AfterCustomer(AfterAddress(country = null, region = null)))
        assertEquals(false, cancellation.canAutoRefund(pickupPoint))
        assertEquals(true, labels.needsCustomsForm(pickupPoint))
    }
}
