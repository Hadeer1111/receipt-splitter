"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSplit, useSplits } from "@/lib/hooks";
import { computeSplitSummary } from "@/lib/split-utils";
import { generateMessage } from "@/lib/message-generator";
import type { Tone } from "@/lib/types";
import { getInstapay } from "@/lib/types";
import {
  PageShell,
  Card,
  Button,
  LoadingSpinner,
  Toast,
  EmptyState,
} from "@/components/ui";
import { cn, formatCents } from "@/lib/utils";

const TONES: { id: Tone; label: string }[] = [
  { id: "chill", label: "Chill" },
  { id: "roast", label: "Roast" },
  { id: "corporate", label: "Corporate" },
  { id: "wholesome", label: "Wholesome" },
];

export default function SplitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { split, loaded } = useSplit(id);
  const { remove } = useSplits();
  const [tone, setTone] = useState<Tone>("chill");
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState(false);

  const summary = useMemo(() => (split ? computeSplitSummary(split) : null), [split]);

  if (!loaded) return <LoadingSpinner />;
  if (!split) {
    return (
      <PageShell title="Split not found">
        <EmptyState title="Not found" description="This split may have been deleted." />
      </PageShell>
    );
  }

  const payer = split.participants.find((p) => p.id === split.payerParticipantId);

  function handleGenerateMessage() {
    if (!summary) return;
    const msg = generateMessage(summary, payer?.name ?? "Payer", getInstapay(payer ?? {}), tone);
    setMessage(msg);
  }

  async function copyMessage() {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  }

  return (
    <PageShell title={split.title} subtitle={`Paid by ${payer?.name ?? "Unknown"}`}>
      <Card className="mb-4">
        <h3 className="mb-3 font-semibold">Line Items</h3>
        {split.lineItems.map((item) => (
          <div key={item.id} className="flex justify-between py-1 text-sm">
            <span>
              {item.name}
              {item.quantity > 1 ? ` x${item.quantity}` : ""}
            </span>
            <span>{formatCents(item.priceCents * item.quantity)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm text-muted">
          <span>Tax</span>
          <span>{formatCents(split.taxCents)}</span>
        </div>
        <div className="flex justify-between text-sm text-muted">
          <span>Tip</span>
          <span>{formatCents(split.tipCents)}</span>
        </div>
      </Card>

      {summary && (
        <Card className="mb-4">
          <h3 className="mb-3 font-semibold">Who owes what</h3>
          {summary.participants.map((p) => (
            <div key={p.participantId} className="flex justify-between py-1 text-sm">
              <span>{p.name}</span>
              <span className="font-medium">
                {p.amountOwedCents > 0 ? `owes ${formatCents(p.amountOwedCents)}` : "paid"}
              </span>
            </div>
          ))}
        </Card>
      )}

      <Card className="mb-4 space-y-4">
        <h3 className="font-semibold">Group chat message</h3>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTone(t.id)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium",
                tone === t.id ? "bg-primary text-white" : "bg-accent",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button onClick={handleGenerateMessage}>Generate message</Button>
        {message && (
          <>
            <pre className="whitespace-pre-wrap rounded-xl bg-accent p-4 text-sm leading-relaxed">
              {message}
            </pre>
            <Button className="w-full" onClick={copyMessage}>
              Copy to clipboard
            </Button>
          </>
        )}
      </Card>

      <Button
        variant="danger"
        className="w-full"
        onClick={() => {
          remove(id);
          router.push("/");
        }}
      >
        Delete split
      </Button>

      <Toast message="Copied to clipboard!" visible={toast} />
    </PageShell>
  );
}
