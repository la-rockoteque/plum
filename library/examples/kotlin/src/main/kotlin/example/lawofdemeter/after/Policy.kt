package example.lawofdemeter.after

// Each object only talks to its own data or its direct collaborator; the caller asks Order one
// question at a time. A pickup point's missing country is absorbed where it lives, in Address,
// instead of blowing up three hops away.

data class Country(val code: String)

data class Address(val country: Country?) { // null for a pickup point
    fun isDomestic(): Boolean = country != null && country.code == "US"
}

data class Card(val expired: Boolean) {
    fun isExpired(): Boolean = expired
}

data class Wallet(val card: Card) {
    fun hasValidCard(): Boolean = !card.isExpired()
}

data class Customer(val address: Address, val wallet: Wallet) {
    fun shipsDomestically(): Boolean = address.isDomestic()

    fun canAutoRefund(): Boolean = wallet.hasValidCard()
}

data class Order(val customer: Customer) {
    fun returnsShipDomestically(): Boolean = customer.shipsDomestically()

    fun canAutoRefund(): Boolean = customer.canAutoRefund()
}

class CancellationPolicy {
    fun shipsDomestically(order: Order): Boolean = order.returnsShipDomestically()

    fun canAutoRefund(order: Order): Boolean = order.canAutoRefund()
}
