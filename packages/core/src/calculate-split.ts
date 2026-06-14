import type { LineItem, Participant, SplitInput, SplitResult, ParticipantResult } from "./schemas.js";

export class SplitCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SplitCalculationError";
  }
}

function distributeProportional(
  totalCents: number,
  weights: Map<string, number>,
): Map<string, number> {
  const result = new Map<string, number>();
  const entries = [...weights.entries()];
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);

  if (totalWeight === 0) {
    for (const [id] of entries) {
      result.set(id, 0);
    }
    return result;
  }

  let allocated = 0;
  const shares: Array<{ id: string; exact: number; floor: number; remainder: number }> = [];

  for (const [id, weight] of entries) {
    const exact = (totalCents * weight) / totalWeight;
    const floor = Math.floor(exact);
    shares.push({ id, exact, floor, remainder: exact - floor });
    allocated += floor;
  }

  let remaining = totalCents - allocated;
  shares.sort((a, b) => b.remainder - a.remainder || b.floor - a.floor);

  for (const share of shares) {
    const extra = remaining > 0 ? 1 : 0;
    if (remaining > 0) remaining -= 1;
    result.set(share.id, share.floor + extra);
  }

  return result;
}

export function calculateSplit(input: SplitInput): SplitResult {
  const participantMap = new Map<string, Participant>(
    input.participants.map((p) => [p.id, p]),
  );

  if (!participantMap.has(input.payerId)) {
    throw new SplitCalculationError("Payer must be one of the participants");
  }

  for (const item of input.lineItems) {
    if (item.assigneeIds.length === 0) {
      throw new SplitCalculationError(`Line item "${item.name}" has no assignees`);
    }
    for (const assigneeId of item.assigneeIds) {
      if (!participantMap.has(assigneeId)) {
        throw new SplitCalculationError(
          `Assignee ${assigneeId} for "${item.name}" is not a participant`,
        );
      }
    }
  }

  const subtotals = new Map<string, number>();
  const itemSharesByParticipant = new Map<string, Map<string, { name: string; cents: number }>>();

  for (const participant of input.participants) {
    subtotals.set(participant.id, 0);
    itemSharesByParticipant.set(participant.id, new Map());
  }

  let itemsSubtotalCents = 0;

  for (const item of input.lineItems) {
    const lineTotal = item.priceCents * item.quantity;
    itemsSubtotalCents += lineTotal;
    const sharePerPerson = Math.floor(lineTotal / item.assigneeIds.length);
    let allocated = sharePerPerson * item.assigneeIds.length;
    let remainder = lineTotal - allocated;

    const sortedAssignees = [...item.assigneeIds].sort((a, b) => {
      const subA = subtotals.get(a) ?? 0;
      const subB = subtotals.get(b) ?? 0;
      return subB - subA || a.localeCompare(b);
    });

    for (let i = 0; i < sortedAssignees.length; i++) {
      const assigneeId = sortedAssignees[i];
      const extra = i < remainder ? 1 : 0;
      const share = sharePerPerson + extra;

      subtotals.set(assigneeId, (subtotals.get(assigneeId) ?? 0) + share);

      const shares = itemSharesByParticipant.get(assigneeId)!;
      const existing = shares.get(item.id);
      if (existing) {
        existing.cents += share;
      } else {
        shares.set(item.id, { name: item.name, cents: share });
      }
    }
  }

  const taxShares = distributeProportional(input.taxCents, subtotals);
  const tipShares = distributeProportional(input.tipCents, subtotals);

  const participants: ParticipantResult[] = input.participants.map((participant) => {
    const subtotalCents = subtotals.get(participant.id) ?? 0;
    const taxCents = taxShares.get(participant.id) ?? 0;
    const tipCents = tipShares.get(participant.id) ?? 0;
    const totalCents = subtotalCents + taxCents + tipCents;
    const amountOwedCents =
      participant.id === input.payerId ? 0 : totalCents;

    const shares = itemSharesByParticipant.get(participant.id)!;
    const itemShares = [...shares.entries()].map(([lineItemId, { name, cents }]) => ({
      lineItemId,
      lineItemName: name,
      shareCents: cents,
    }));

    return {
      participantId: participant.id,
      name: participant.name,
      itemShares,
      subtotalCents,
      taxCents,
      tipCents,
      totalCents,
      amountOwedCents,
    };
  });

  const grandTotalCents = itemsSubtotalCents + input.taxCents + input.tipCents;
  const participantTotal = participants.reduce((sum, p) => sum + p.totalCents, 0);

  if (participantTotal !== grandTotalCents) {
    throw new SplitCalculationError(
      `Totals do not reconcile: ${participantTotal} vs ${grandTotalCents}`,
    );
  }

  return {
    participants,
    payerId: input.payerId,
    grandTotalCents,
    itemsSubtotalCents,
    taxCents: input.taxCents,
    tipCents: input.tipCents,
  };
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function splitInputFromPayload(payload: {
  participants: Array<{ id: string; name: string; instapay?: string | null }>;
  payerParticipantId: string;
  lineItems: Array<{
    id: string;
    name: string;
    priceCents: number;
    quantity: number;
    assignments: Array<{ participantId: string }>;
  }>;
  taxCents: number;
  tipCents: number;
}): SplitInput {
  return {
    participants: payload.participants.map((p) => ({
      id: p.id,
      name: p.name,
      instapay: p.instapay ?? undefined,
    })),
    payerId: payload.payerParticipantId,
    lineItems: payload.lineItems.map((item) => ({
      id: item.id,
      name: item.name,
      priceCents: item.priceCents,
      quantity: item.quantity,
      assigneeIds: item.assignments.map((a) => a.participantId),
    })),
    taxCents: payload.taxCents,
    tipCents: payload.tipCents,
  };
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}
