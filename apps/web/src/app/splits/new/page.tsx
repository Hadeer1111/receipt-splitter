"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useGroups, useSplits } from "@/lib/hooks";
import { calculateSplit } from "@receipt-splitter/core";
import type { Tone, StoredSplit } from "@/lib/types";
import { getInstapay } from "@/lib/types";
import { generateMessage } from "@/lib/message-generator";
import { computeSplitSummary } from "@/lib/split-utils";
import {
  PageShell,
  Card,
  Button,
  Input,
  Toast,
} from "@/components/ui";
import { ReceiptScanner, applyParsedReceipt } from "@/components/receipt-scanner";
import {
  cn,
  formatCents,
  parseDollarsToCents,
  formatDollarsInput,
} from "@/lib/utils";

interface Participant {
  id: string;
  name: string;
  instapay: string;
  isPayer: boolean;
}

interface LineItem {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
  assigneeIds: string[];
}

const STEPS = ["People", "Items", "Assign", "Tax & Tip", "Summary"];
const TONES: { id: Tone; label: string }[] = [
  { id: "chill", label: "Chill" },
  { id: "roast", label: "Roast" },
  { id: "corporate", label: "Corporate" },
  { id: "wholesome", label: "Wholesome" },
];

function uid() {
  return crypto.randomUUID();
}

export default function NewSplitPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([
    { id: uid(), name: "", instapay: "", isPayer: true },
    { id: uid(), name: "", instapay: "", isPayer: false },
  ]);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: uid(), name: "", priceCents: 0, quantity: 1, assigneeIds: [] },
  ]);
  const [taxInput, setTaxInput] = useState("");
  const [tipInput, setTipInput] = useState("");
  const [tipPercent, setTipPercent] = useState("");
  const [tone, setTone] = useState<Tone>("chill");
  const [message, setMessage] = useState("");
  const [savedSplitId, setSavedSplitId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(false);
  const [saving, setSaving] = useState(false);

  const { groups } = useGroups();
  const { save: saveSplitToStorage } = useSplits();

  const payer = participants.find((p) => p.isPayer) ?? participants[0];

  const liveSummary = useMemo(() => {
    try {
      const validParticipants = participants.filter((p) => p.name.trim());
      const validItems = lineItems.filter(
        (i) => i.name.trim() && i.priceCents > 0 && i.assigneeIds.length > 0,
      );
      if (validParticipants.length === 0 || validItems.length === 0 || !payer?.id) return null;

      return calculateSplit({
        participants: validParticipants.map((p) => ({ id: p.id, name: p.name })),
        payerId: payer.id,
        lineItems: validItems,
        taxCents: parseDollarsToCents(taxInput),
        tipCents: parseDollarsToCents(tipInput),
      });
    } catch {
      return null;
    }
  }, [participants, lineItems, payer, taxInput, tipInput]);

  function loadGroup(groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setParticipants(
      group.members.map((m, i) => ({
        id: uid(),
        name: m.name,
        instapay: getInstapay(m) ?? "",
        isPayer: i === 0,
      })),
    );
  }

  function addParticipant() {
    setParticipants([...participants, { id: uid(), name: "", instapay: "", isPayer: false }]);
  }

  function updateParticipant(id: string, field: keyof Participant, value: string | boolean) {
    setParticipants(
      participants.map((p) => {
        if (field === "isPayer" && value === true) {
          return { ...p, isPayer: p.id === id };
        }
        if (p.id !== id) return field === "isPayer" ? { ...p, isPayer: false } : p;
        return { ...p, [field]: value };
      }),
    );
  }

  function removeParticipant(id: string) {
    if (participants.length <= 1) return;
    setParticipants(participants.filter((p) => p.id !== id));
    setLineItems(
      lineItems.map((item) => ({
        ...item,
        assigneeIds: item.assigneeIds.filter((a) => a !== id),
      })),
    );
  }

  function addLineItem() {
    setLineItems([
      ...lineItems,
      { id: uid(), name: "", priceCents: 0, quantity: 1, assigneeIds: [] },
    ]);
  }

  function updateLineItem(id: string, updates: Partial<LineItem>) {
    setLineItems(lineItems.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  }

  function removeLineItem(id: string) {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((i) => i.id !== id));
  }

  function toggleAssignee(itemId: string, participantId: string) {
    setLineItems(
      lineItems.map((item) => {
        if (item.id !== itemId) return item;
        const has = item.assigneeIds.includes(participantId);
        return {
          ...item,
          assigneeIds: has
            ? item.assigneeIds.filter((a) => a !== participantId)
            : [...item.assigneeIds, participantId],
        };
      }),
    );
  }

  function applyTipPercent() {
    const subtotal = lineItems.reduce((s, i) => s + i.priceCents * i.quantity, 0);
    const pct = parseFloat(tipPercent);
    if (!isNaN(pct)) {
      setTipInput(formatDollarsInput(Math.round(subtotal * (pct / 100))));
    }
  }

  function validateStep(): boolean {
    setError("");
    if (step === 0) {
      if (!title.trim()) { setError("Title required"); return false; }
      const valid = participants.filter((p) => p.name.trim());
      if (valid.length < 1) { setError("Add at least one person"); return false; }
      if (!participants.some((p) => p.isPayer)) { setError("Select who paid"); return false; }
    }
    if (step === 1) {
      const valid = lineItems.filter((i) => i.name.trim() && i.priceCents > 0);
      if (valid.length < 1) { setError("Add at least one item"); return false; }
    }
    if (step === 2) {
      const unassigned = lineItems.filter((i) => i.name.trim() && i.assigneeIds.length === 0);
      if (unassigned.length > 0) { setError("Assign all items to at least one person"); return false; }
    }
    return true;
  }

  function nextStep() {
    if (!validateStep()) return;
    if (step === 3) {
      saveSplit();
      return;
    }
    setStep(step + 1);
  }

  function saveSplit() {
    setSaving(true);
    setError("");

    try {
      const payerParticipant = participants.find((p) => p.isPayer) ?? participants[0];
      const split: StoredSplit = {
        id: uid(),
        title: title.trim(),
        payerParticipantId: payerParticipant.id,
        taxCents: parseDollarsToCents(taxInput),
        tipCents: parseDollarsToCents(tipInput),
        tipPercent: tipPercent ? parseFloat(tipPercent) : undefined,
        createdAt: new Date().toISOString(),
        participants: participants
          .filter((p) => p.name.trim())
          .map((p) => ({
            id: p.id,
            name: p.name.trim(),
            instapay: p.instapay.trim() || undefined,
          })),
        lineItems: lineItems
          .filter((i) => i.name.trim() && i.priceCents > 0)
          .map((i) => ({
            id: i.id,
            name: i.name.trim(),
            priceCents: i.priceCents,
            quantity: i.quantity,
            assigneeIds: i.assigneeIds,
          })),
      };

      saveSplitToStorage(split);
      const summary = computeSplitSummary(split);
      const msg = generateMessage(
        summary,
        payerParticipant.name,
        payerParticipant.instapay || undefined,
        tone,
      );
      setSavedSplitId(split.id);
      setMessage(msg);
      setStep(4);
    } catch {
      setError("Failed to save split");
    } finally {
      setSaving(false);
    }
  }

  async function copyMessage() {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  }

  function regenerateMessage() {
    if (!savedSplitId) return;
    const split = {
      id: savedSplitId,
      title: title.trim(),
      payerParticipantId: payer.id,
      taxCents: parseDollarsToCents(taxInput),
      tipCents: parseDollarsToCents(tipInput),
      tipPercent: tipPercent ? parseFloat(tipPercent) : undefined,
      createdAt: new Date().toISOString(),
      participants: participants.filter((p) => p.name.trim()).map((p) => ({
        id: p.id,
        name: p.name.trim(),
        instapay: p.instapay.trim() || undefined,
      })),
      lineItems: lineItems
        .filter((i) => i.name.trim() && i.priceCents > 0)
        .map((i) => ({
          id: i.id,
          name: i.name.trim(),
          priceCents: i.priceCents,
          quantity: i.quantity,
          assigneeIds: i.assigneeIds,
        })),
    } satisfies StoredSplit;

    const summary = computeSplitSummary(split);
    const payerParticipant = participants.find((p) => p.isPayer);
    setMessage(generateMessage(summary, payerParticipant?.name ?? "Payer", payerParticipant?.instapay, tone));
  }

  return (
    <PageShell title="New Split" subtitle={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
      <div className="mb-6 flex gap-1">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full",
              i <= step ? "bg-primary" : "bg-border",
            )}
          />
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {step === 0 && (
        <div className="space-y-4">
          <Input label="Split title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Taco Tuesday" />
          {groups.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-muted">Load from group</p>
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => (
                  <Button key={g.id} type="button" variant="secondary" onClick={() => loadGroup(g.id)}>
                    {g.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted">People</p>
            {participants.map((p) => (
              <Card key={p.id} className="space-y-2">
                <Input placeholder="Name" value={p.name} onChange={(e) => updateParticipant(p.id, "name", e.target.value)} />
                <Input
                  placeholder="InstaPay phone or @handler"
                  value={p.instapay}
                  onChange={(e) => updateParticipant(p.id, "instapay", e.target.value)}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={p.isPayer}
                    onChange={() => updateParticipant(p.id, "isPayer", true)}
                  />
                  Paid the bill
                </label>
                {participants.length > 1 && (
                  <Button variant="ghost" type="button" onClick={() => removeParticipant(p.id)}>Remove</Button>
                )}
              </Card>
            ))}
            <Button variant="secondary" type="button" onClick={addParticipant}>+ Add person</Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <ReceiptScanner
            onParsed={(parsed) => {
              applyParsedReceipt(parsed, setLineItems, setTaxInput, setTipInput);
              setError("");
            }}
          />
          <p className="text-sm font-medium text-muted">Line items</p>
          {lineItems.map((item) => (
            <Card key={item.id} className="space-y-2">
              <Input placeholder="Item name" value={item.name} onChange={(e) => updateLineItem(item.id, { name: e.target.value })} />
              <div className="flex gap-2">
                <Input
                  placeholder="Price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.priceCents ? formatDollarsInput(item.priceCents) : ""}
                  onChange={(e) => updateLineItem(item.id, { priceCents: parseDollarsToCents(e.target.value) })}
                />
                <Input
                  placeholder="Qty"
                  type="number"
                  min="1"
                  className="w-20"
                  value={item.quantity}
                  onChange={(e) => updateLineItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              {lineItems.length > 1 && (
                <Button variant="ghost" type="button" onClick={() => removeLineItem(item.id)}>Remove</Button>
              )}
            </Card>
          ))}
          <Button variant="secondary" type="button" onClick={addLineItem}>+ Add item</Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 pb-24">
          {lineItems.filter((i) => i.name.trim()).map((item) => (
            <Card key={item.id}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="text-sm text-muted">
                    {formatCents(item.priceCents * item.quantity)}
                    {item.quantity > 1 ? ` (${item.quantity}x)` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {participants.filter((p) => p.name.trim()).map((p) => {
                  const selected = item.assigneeIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleAssignee(item.id, p.id)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-sm font-medium transition",
                        selected
                          ? "bg-primary text-white"
                          : "bg-accent text-foreground",
                      )}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </Card>
          ))}

          {liveSummary && (
            <div className="fixed bottom-16 left-0 right-0 border-t border-border bg-card px-4 py-3">
              <div className="mx-auto max-w-lg">
                <p className="mb-2 text-xs font-semibold uppercase text-muted">Running totals</p>
                <div className="flex flex-wrap gap-3">
                  {liveSummary.participants.map((p) => (
                    <span key={p.participantId} className="text-sm">
                      {p.name}: <strong>{formatCents(p.totalCents)}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Input
            label="Tax"
            placeholder="0.00"
            type="number"
            step="0.01"
            min="0"
            value={taxInput}
            onChange={(e) => setTaxInput(e.target.value)}
          />
          <div className="space-y-2">
            <Input
              label="Tip"
              placeholder="0.00"
              type="number"
              step="0.01"
              min="0"
              value={tipInput}
              onChange={(e) => setTipInput(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Tip %"
                type="number"
                min="0"
                value={tipPercent}
                onChange={(e) => setTipPercent(e.target.value)}
              />
              <Button type="button" variant="secondary" onClick={applyTipPercent}>
                Apply %
              </Button>
            </div>
          </div>
          {liveSummary && (
            <Card>
              <h3 className="mb-3 font-semibold">Preview</h3>
              {liveSummary.participants.map((p) => (
                <div key={p.participantId} className="flex justify-between py-1 text-sm">
                  <span>{p.name}{p.amountOwedCents === 0 ? " (paid)" : ""}</span>
                  <span className="font-medium">
                    {p.amountOwedCents > 0 ? `owes ${formatCents(p.amountOwedCents)}` : formatCents(p.totalCents)}
                  </span>
                </div>
              ))}
              <div className="mt-3 flex justify-between border-t border-border pt-3 font-semibold">
                <span>Total</span>
                <span>{formatCents(liveSummary.grandTotalCents)}</span>
              </div>
            </Card>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-muted">Tone</p>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setTone(t.id); regenerateMessage(); }}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium",
                    tone === t.id ? "bg-primary text-white" : "bg-accent",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {saving ? (
            <p className="text-sm text-muted">Generating your message...</p>
          ) : (
            <Card>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed">{message}</pre>
            </Card>
          )}
          <Button className="w-full" onClick={copyMessage} disabled={!message}>
            Copy to clipboard
          </Button>
          {savedSplitId && (
            <Button variant="secondary" className="w-full" onClick={() => router.push(`/splits/${savedSplitId}`)}>
              View saved split
            </Button>
          )}
        </div>
      )}

      {step < 4 && (
        <div className="mt-8 flex gap-3">
          {step > 0 && (
            <Button variant="secondary" className="flex-1" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button
            className="flex-1"
            onClick={nextStep}
            disabled={saving}
          >
            {step === 3 ? (saving ? "Saving..." : "Save & Generate") : "Next"}
          </Button>
        </div>
      )}

      <Toast message="Copied to clipboard!" visible={toast} />
    </PageShell>
  );
}
