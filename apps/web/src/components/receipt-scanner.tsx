"use client";

import { useRef, useState } from "react";
import { parseReceipt, ApiError } from "@/lib/api";
import type { ParsedReceipt } from "@/lib/types";
import { Button, Card } from "@/components/ui";
import { formatDollarsInput } from "@/lib/utils";

interface ReceiptScannerProps {
  onParsed: (result: ParsedReceipt) => void;
}

export function ReceiptScanner({ onParsed }: ReceiptScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File | null) {
    if (!file) return;
    setError("");

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setLoading(true);

    try {
      const result = await parseReceipt(file);
      onParsed(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to scan receipt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="font-semibold">Scan receipt</h3>
        <p className="text-sm text-muted">
          Take a photo or upload an image to auto-fill items, tax, and tip.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      {preview && (
        <div className="overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Receipt preview" className="max-h-48 w-full object-contain bg-black/5" />
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          className="flex-1"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          {loading ? "Reading receipt..." : preview ? "Scan another" : "Take photo / upload"}
        </Button>
      </div>

      {loading && (
        <p className="text-sm text-muted">Extracting line items — this usually takes a few seconds.</p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </Card>
  );
}

export function applyParsedReceipt(
  parsed: ParsedReceipt,
  setLineItems: React.Dispatch<
    React.SetStateAction<
      Array<{
        id: string;
        name: string;
        priceCents: number;
        quantity: number;
        assigneeIds: string[];
      }>
    >
  >,
  setTaxInput: (v: string) => void,
  setTipInput: (v: string) => void,
) {
  setLineItems(
    parsed.items.map((item) => ({
      id: crypto.randomUUID(),
      name: item.name,
      priceCents: item.priceCents,
      quantity: item.quantity,
      assigneeIds: [],
    })),
  );

  if (parsed.taxCents != null && parsed.taxCents > 0) {
    setTaxInput(formatDollarsInput(parsed.taxCents));
  }
  if (parsed.tipCents != null && parsed.tipCents > 0) {
    setTipInput(formatDollarsInput(parsed.tipCents));
  }
}
