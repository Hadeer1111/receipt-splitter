import { formatCents } from "@receipt-splitter/core";

export { formatCents };

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function parseDollarsToCents(value: string): number {
  const parsed = parseFloat(value.replace(/[^0-9.]/g, ""));
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

export function formatDollarsInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
