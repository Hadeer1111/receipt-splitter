export interface GroupMember {
  id: string;
  name: string;
  instapay?: string;
  /** @deprecated migrated from venmo */
  venmo?: string;
}

export interface StoredGroup {
  id: string;
  name: string;
  members: GroupMember[];
  updatedAt: string;
}

export interface StoredLineItem {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
  assigneeIds: string[];
}

export interface StoredParticipant {
  id: string;
  name: string;
  instapay?: string;
  /** @deprecated migrated from venmo */
  venmo?: string;
}

export interface StoredSplit {
  id: string;
  title: string;
  payerParticipantId: string;
  taxCents: number;
  tipCents: number;
  tipPercent?: number;
  createdAt: string;
  participants: StoredParticipant[];
  lineItems: StoredLineItem[];
}

export type Tone = "chill" | "roast" | "corporate" | "wholesome";

export interface ParsedReceipt {
  items: Array<{ name: string; priceCents: number; quantity: number }>;
  taxCents?: number;
  tipCents?: number;
}

/** Read instapay from participant, falling back to legacy venmo field */
export function getInstapay(participant: { instapay?: string; venmo?: string }): string | undefined {
  return participant.instapay?.trim() || participant.venmo?.trim() || undefined;
}
