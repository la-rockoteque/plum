import { describe, expect, test } from "vitest";
import { ApiError, InMemoryOrderApi } from "../src/order-api";

describe("InMemoryOrderApi fixture", () => {
  test("cancels once and rejects a second cancel", async () => {
    const api = new InMemoryOrderApi();
    await expect(api.cancel(1)).resolves.toMatchObject({ status: "cancelled" });
    await expect(api.cancel(1)).rejects.toBeInstanceOf(ApiError);
  });

  test("held responses resolve only on release", async () => {
    const api = new InMemoryOrderApi();
    api.holdResponses = true;
    let settled = false;
    const request = api.getOrder(1).then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    api.release();
    await request;
    expect(settled).toBe(true);
  });

  test("failNext fails exactly one request", async () => {
    const api = new InMemoryOrderApi();
    api.failNext = "gateway down";
    await expect(api.getOrder(1)).rejects.toThrow("gateway down");
    await expect(api.getOrder(1)).resolves.toMatchObject({ id: 1 });
  });
});
