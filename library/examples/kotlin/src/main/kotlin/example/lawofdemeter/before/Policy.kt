package example.lawofdemeter.before

// Teaching artifact: the refund and customs decisions each walk straight through the
// customer's address to read its country -- a train wreck that breaks not by crashing, but by
// silently giving the wrong answer the day the country moves one hop further out.

data class Country(val code: String)

// Introduced later: countries are grouped under a customs region.
data class Region(val country: Country)

data class Address(
    // Exactly one of these is set: `country` for an address created before the region
    // migration, `region` for one created after it. Neither caller below knows about `region`.
    val country: Country?,
    val region: Region?,
)

data class Customer(val address: Address)

data class Order(val customer: Customer)

class CancellationPolicy {
    fun canAutoRefund(order: Order): Boolean {
        // Train wreck: order -> customer -> address -> country -> code.
        val country = order.customer.address.country
            ?: return false // play it safe: no auto-refund if we can't read a country
        return country.code == "US"
    }
}

class ReturnLabelPrinter {
    fun needsCustomsForm(order: Order): Boolean {
        // Train wreck: order -> customer -> address -> country -> code.
        val country = order.customer.address.country
            ?: return true // play it safe: assume a customs form is needed
        return country.code != "US"
    }
}
