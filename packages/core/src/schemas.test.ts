import { describe, it, expect } from "vitest";
import { parsedReceiptSchema } from "@receipt-splitter/core";

describe("parsedReceiptSchema", () => {
  it("validates a parsed receipt payload", () => {
    const result = parsedReceiptSchema.safeParse({
      items: [{ name: "Burger", priceCents: 1500, quantity: 1 }],
      taxCents: 120,
      tipCents: 300,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty items", () => {
    const result = parsedReceiptSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
  });
});
