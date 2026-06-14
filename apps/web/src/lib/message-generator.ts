import type { SplitResult, Tone, ParticipantResult } from "@receipt-splitter/core";
import { formatCents } from "@receipt-splitter/core";

const quips: Record<Tone, string[]> = {
  chill: ["living their best life", "no notes", "solid choices", "ate and left no crumbs"],
  roast: ["main character energy", "wallet said ouch", "bold ordering strategy", "the group subsidized this"],
  corporate: ["cost center approved", "within budget parameters", "expense allocation confirmed", "QBR-worthy appetite"],
  wholesome: ["deserved every bite", "nourishing the soul", "a joy to share a table with", "happiness on a plate"],
};

const headers: Record<Tone, string[]> = {
  chill: ["Bill's handled. Here's the vibe:", "Math done. You're welcome:", "Split locked in:"],
  roast: ["The receipt has entered the chat:", "Forensic accounting complete:", "Your wallet crimes, itemized:"],
  corporate: ["ACTION REQUIRED: Settlement Summary", "Expense Reconciliation Report", "Payment Obligations — EOD"],
  wholesome: ["What a lovely meal together!", "Grateful for this table:", "Sharing is caring (and math):"],
};

function hashSeed(parts: string[]): number {
  let hash = 0;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pick<T>(arr: T[], seed: number, offset = 0): T {
  return arr[(seed + offset) % arr.length];
}

function topItemQuip(participant: ParticipantResult, tone: Tone, seed: number): string {
  if (participant.itemShares.length === 0) return pick(quips[tone], seed);
  const top = [...participant.itemShares].sort((a, b) => b.shareCents - a.shareCents)[0];
  const quip = pick(quips[tone], seed, top.lineItemName.length);
  return `${quip} with that ${top.lineItemName.toLowerCase()}`;
}

export function generateMessage(
  summary: SplitResult,
  payerName: string,
  payerInstapay: string | null | undefined,
  tone: Tone,
): string {
  const seed = hashSeed([
    tone,
    payerName,
    ...summary.participants.map((p) => `${p.name}:${p.amountOwedCents}`),
  ]);

  const header = pick(headers[tone], seed);
  const lines: string[] = [header, ""];

  const owed = summary.participants.filter((p) => p.amountOwedCents > 0);

  if (owed.length === 0) {
    lines.push("Everyone's square. Legendary.");
    return lines.join("\n");
  }

  lines.push(`${payerName} covered the bill — send them:`);

  owed.forEach((p, i) => {
    const quip = topItemQuip(p, tone, seed + i);
    lines.push(`• ${p.name} → ${formatCents(p.amountOwedCents)} (${quip})`);
  });

  lines.push("");
  if (payerInstapay) lines.push(`InstaPay: ${payerInstapay}`);

  const footers: Record<Tone, string> = {
    chill: "No notes = assumed guilt.",
    roast: "Pay up before the vibes curdle.",
    corporate: "Please remit by end of day. No blockers.",
    wholesome: "Thank you for sharing this meal together!",
  };
  lines.push(footers[tone]);

  return lines.join("\n");
}
