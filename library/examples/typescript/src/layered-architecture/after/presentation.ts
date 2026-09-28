import { OrderNotFound } from "./application.js";
import { OrderCannotBeCancelled } from "./domain.js";

export interface CancelRequest {
  orderId: string; // arrives as a string, as it would from a web request
}

export interface CancelResponse {
  status: "ok" | "invalid" | "not_found" | "rejected";
  message: string;
}

// What the handler depends on: the application layer, not any one implementation.
export interface CancelOrderUseCase {
  execute(orderId: number): void;
}

// Presentation layer: parse the request into a command, call the use case, shape a response.
export function handleCancelRequest(
  request: CancelRequest,
  useCase: CancelOrderUseCase,
): CancelResponse {
  if (!/^\d+$/.test(request.orderId)) {
    return { status: "invalid", message: "order id must be a number" };
  }
  const orderId = Number(request.orderId); // the command, once validated

  try {
    useCase.execute(orderId);
  } catch (error) {
    if (error instanceof OrderNotFound) {
      return { status: "not_found", message: `order ${orderId} not found` };
    }
    if (error instanceof OrderCannotBeCancelled) {
      return { status: "rejected", message: error.message };
    }
    throw error;
  }
  return { status: "ok", message: `order ${orderId} cancelled` };
}
