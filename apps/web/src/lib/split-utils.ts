import { calculateSplit, type SplitResult } from "@receipt-splitter/core";
import type { StoredSplit } from "./types";
import { getInstapay } from "./types";

export function computeSplitSummary(split: StoredSplit): SplitResult {
  return calculateSplit({
    participants: split.participants.map((p) => ({
      id: p.id,
      name: p.name,
      instapay: getInstapay(p),
    })),
    payerId: split.payerParticipantId,
    lineItems: split.lineItems.map((item) => ({
      id: item.id,
      name: item.name,
      priceCents: item.priceCents,
      quantity: item.quantity,
      assigneeIds: item.assigneeIds,
    })),
    taxCents: split.taxCents,
    tipCents: split.tipCents,
  });
}
