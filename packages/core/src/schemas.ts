import { z } from "zod";

export const toneSchema = z.enum(["chill", "roast", "corporate", "wholesome"]);
export type Tone = z.infer<typeof toneSchema>;

export const participantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  instapay: z.string().optional(),
});

export const lineItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
  assigneeIds: z.array(z.string()).min(1),
});

export const splitInputSchema = z.object({
  participants: z.array(participantSchema).min(1),
  payerId: z.string().min(1),
  lineItems: z.array(lineItemSchema).min(1),
  taxCents: z.number().int().nonnegative(),
  tipCents: z.number().int().nonnegative(),
});

export type Participant = z.infer<typeof participantSchema>;
export type LineItem = z.infer<typeof lineItemSchema>;
export type SplitInput = z.infer<typeof splitInputSchema>;

export interface ParticipantItemShare {
  lineItemId: string;
  lineItemName: string;
  shareCents: number;
}

export interface ParticipantResult {
  participantId: string;
  name: string;
  itemShares: ParticipantItemShare[];
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  amountOwedCents: number;
}

export interface SplitResult {
  participants: ParticipantResult[];
  payerId: string;
  grandTotalCents: number;
  itemsSubtotalCents: number;
  taxCents: number;
  tipCents: number;
}

export const generateMessageSchema = z.object({
  tone: toneSchema,
});

export const parsedReceiptItemSchema = z.object({
  name: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
});

export const parsedReceiptSchema = z.object({
  items: z.array(parsedReceiptItemSchema).min(1),
  taxCents: z.number().int().nonnegative().optional(),
  tipCents: z.number().int().nonnegative().optional(),
});

export type ParsedReceiptItem = z.infer<typeof parsedReceiptItemSchema>;
export type ParsedReceipt = z.infer<typeof parsedReceiptSchema>;
