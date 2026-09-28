package example.lawofdemeter.before

// Teaching artifact: cancelling an order walks straight through the customer's address and
// wallet to decide how to ship the return and whether to auto-refund — a train wreck that
// breaks the moment one address turns out not to have a country.

data class Country(val code: String)

// Null for a pickup point — no single country's customs apply.
data class Address(val country: Country?)

data class Card(val expired: Boolean)

data class Wallet(val card: Card)

data class Customer(val address: Address, val wallet: Wallet)

data class Order(val customer: Customer)

class CancellationPolicy {
    fun shipsDomestically(order: Order): Boolean =
        // Train wreck: order -> customer -> address -> country -> code. The `!!` is the tell:
        // the caller assumed a country is always there.
        order.customer.address.country!!.code == "US"

    fun canAutoRefund(order: Order): Boolean =
        // Train wreck: order -> customer -> wallet -> card -> expired.
        !order.customer.wallet.card.expired
}
