package example.lawofdemeter.after

// Each object only talks to its own data or its direct collaborator. Address answers
// "domestic?" for itself whether it still holds a plain country or, after the region
// migration, a Region one hop further out -- so the callers below never learn the new shape.

data class Country(val code: String)

data class Region(val country: Country) {
    fun isDomestic(): Boolean = country.code == "US"
}

data class Address(val country: Country?, val region: Region?) {
    fun isDomestic(): Boolean {
        region?.let { return it.isDomestic() }
        country?.let { return it.code == "US" }
        return false // a pickup point has no single country either
    }
}

data class Customer(val address: Address) {
    fun canAutoRefund(): Boolean = address.isDomestic()

    fun needsCustomsForm(): Boolean = !address.isDomestic()
}

data class Order(val customer: Customer) {
    fun canAutoRefund(): Boolean = customer.canAutoRefund()

    fun needsCustomsForm(): Boolean = customer.needsCustomsForm()
}

class CancellationPolicy {
    fun canAutoRefund(order: Order): Boolean = order.canAutoRefund()
}

class ReturnLabelPrinter {
    fun needsCustomsForm(order: Order): Boolean = order.needsCustomsForm()
}
