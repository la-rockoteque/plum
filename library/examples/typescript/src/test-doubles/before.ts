// Stand-in for a real SMTP client: this library never opens a socket.
export class SmtpMailer {
  send(_to: string, _message: string): void {
    throw new Error("network unavailable");
  }
}

// Stand-in for a real payment-gateway HTTP client.
export class HttpPaymentGateway {
  charge(_orderId: string, _amount: number): void {
    throw new Error("network unavailable");
  }
}

export class Order {
  status: string;

  constructor(
    public readonly id: string,
    public readonly customerEmail: string,
    public readonly cancellationFee: number,
    status = "placed",
  ) {
    this.status = status;
  }
}

// Self-constructs its collaborators: no test can observe anything but the crash.
export class CancelOrder {
  private readonly gateway = new HttpPaymentGateway();
  private readonly mailer = new SmtpMailer();

  execute(order: Order): void {
    this.gateway.charge(order.id, order.cancellationFee);
    order.status = "cancelled";
    this.mailer.send(order.customerEmail, `Your order ${order.id} was cancelled`);
  }
}
