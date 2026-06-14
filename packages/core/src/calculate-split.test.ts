import { describe, it, expect } from "vitest";
import { calculateSplit, SplitCalculationError } from "./calculate-split.js";

describe("calculateSplit", () => {
  const baseInput = {
    participants: [
      { id: "alice", name: "Alice" },
      { id: "bob", name: "Bob" },
      { id: "carol", name: "Carol" },
    ],
    payerId: "alice",
    lineItems: [
      {
        id: "tacos",
        name: "Tacos",
        priceCents: 2400,
        quantity: 1,
        assigneeIds: ["alice"],
      },
      {
        id: "burrito",
        name: "Burrito",
        priceCents: 1600,
        quantity: 1,
        assigneeIds: ["bob"],
      },
      {
        id: "guac",
        name: "Chips & Guac",
        priceCents: 1200,
        quantity: 1,
        assigneeIds: ["alice", "bob", "carol"],
      },
      {
        id: "quesadilla",
        name: "Quesadilla",
        priceCents: 1400,
        quantity: 1,
        assigneeIds: ["carol"],
      },
    ],
    taxCents: 640,
    tipCents: 1600,
  };

  it("calculates individual and shared items correctly", () => {
    const result = calculateSplit(baseInput);

    expect(result.itemsSubtotalCents).toBe(6600);
    expect(result.grandTotalCents).toBe(8840);

    const alice = result.participants.find((p) => p.participantId === "alice")!;
    const bob = result.participants.find((p) => p.participantId === "bob")!;
    const carol = result.participants.find((p) => p.participantId === "carol")!;

    expect(alice.subtotalCents).toBe(2800);
    expect(bob.subtotalCents).toBe(2000);
    expect(carol.subtotalCents).toBe(1800);

    expect(alice.amountOwedCents).toBe(0);
    expect(bob.amountOwedCents).toBeGreaterThan(0);
    expect(carol.amountOwedCents).toBeGreaterThan(0);
  });

  it("distributes tax and tip proportionally", () => {
    const result = calculateSplit(baseInput);
    const totalTax = result.participants.reduce((s, p) => s + p.taxCents, 0);
    const totalTip = result.participants.reduce((s, p) => s + p.tipCents, 0);

    expect(totalTax).toBe(640);
    expect(totalTip).toBe(1600);
  });

  it("reconciles participant totals with grand total", () => {
    const result = calculateSplit(baseInput);
    const sum = result.participants.reduce((s, p) => s + p.totalCents, 0);
    expect(sum).toBe(result.grandTotalCents);
  });

  it("handles indivisible shared item cents", () => {
    const result = calculateSplit({
      participants: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" },
      ],
      payerId: "a",
      lineItems: [
        {
          id: "fries",
          name: "Fries",
          priceCents: 1000,
          quantity: 1,
          assigneeIds: ["a", "b", "c"],
        },
      ],
      taxCents: 100,
      tipCents: 200,
    });

    const sum = result.participants.reduce((s, p) => s + p.subtotalCents, 0);
    expect(sum).toBe(1000);
    expect(result.grandTotalCents).toBe(1300);
  });

  it("throws when payer is not a participant", () => {
    expect(() =>
      calculateSplit({ ...baseInput, payerId: "unknown" }),
    ).toThrow(SplitCalculationError);
  });

  it("throws when line item has no assignees", () => {
    expect(() =>
      calculateSplit({
        ...baseInput,
        lineItems: [
          {
            id: "x",
            name: "Empty",
            priceCents: 500,
            quantity: 1,
            assigneeIds: [],
          },
        ],
      }),
    ).toThrow(SplitCalculationError);
  });
});
