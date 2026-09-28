// Cancellation fees and refund descriptions vary by order type.
export const STANDARD = "standard";
export const EXPRESS = "express";
export const CUSTOM_MADE = "custom-made";
export const SUBSCRIPTION = "subscription";

export const EXPRESS_FLAT_FEE = 15.0;
export const CUSTOM_MADE_FEE_RATE = 0.5;

export interface Order {
  type: string;
  amount: number;
  pending: boolean;
  monthsElapsed: number;
  totalMonths: number;
}
