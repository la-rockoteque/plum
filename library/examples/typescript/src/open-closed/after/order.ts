// Cancellation fees and refund descriptions vary by order type.
export const STANDARD = "standard";
export const EXPRESS = "express";
export const CUSTOM_MADE = "custom-made";
export const SUBSCRIPTION = "subscription";

export interface Order {
  type: string;
  amount: number;
  pending: boolean;
  monthsElapsed: number;
  totalMonths: number;
}
