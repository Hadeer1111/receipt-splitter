"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseReceipt, ApiError } from "@/lib/api";
import { normalizeReceiptImage } from "@/lib/normalize-image";
import type { ParsedReceipt } from "@/lib/types";
import { Card } from "@/components/ui";
import { formatDollarsInput } from "@/lib/utils";

const GALLERY_INPUT_ID = "receipt-gallery-file";
const CAMERA_INPUT_ID = "receipt-camera-file";

function isMobileDevice() {
  if (typeof window === "undefined") return false;
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && window.matchMedia("(max-width: 768px)").matches)
  );
}

function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

interface ReceiptScannerProps {
  onParsed: (result: ParsedReceipt) => void;
}

type ScanStatus = "idle" | "converting" | "scanning" | "done" | "error";

function FileUploadZone({
  inputId,
  label,
  capture,
  variant = "primary",
}: {
  inputId: string;
  label: string;
  capture?: "environment";
  variant?: "primary" | "secondary";
}) {
  const barClass =
    variant === "primary"
      ? "bg-primary text-white"
      : "border border-border bg-card text-foreground";

  return (
    <div className="relative w-full">
      <div
        className={`flex h-14 w-full items-center justify-center rounded-xl px-4 text-base font-semibold ${barClass}`}
        aria-hidden="true"
      >
        {label}
      </div>
      <input
        id={inputId}
        type="file"
        name={inputId}
        accept="image/*"
        capture={capture}
        className="receipt-file-input"
      />
    </div>
  );
}

export function ReceiptScanner({ onParsed }: ReceiptScannerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onParsedRef = useRef(onParsed);
  const busyRef = useRef(false);

  const [mobile, setMobile] = useState(false);
  const [standalonePwa, setStandalonePwa] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    onParsedRef.current = onParsed;
  }, [onParsed]);

  useEffect(() => {
    setMobile(isMobileDevice());
    setStandalonePwa(isStandalonePwa());
  }, []);

  const processFile = useCallback(async (file: File) => {
    setError("");
    setSelectedName(file.name || "Selected photo");
    setStatus("converting");

    try {
      const normalized = await normalizeReceiptImage(file);
      setPreview(URL.createObjectURL(normalized));
      setStatus("scanning");

      const result = await parseReceipt(normalized);
      onParsedRef.current(result);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "Failed to scan receipt");
    }
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const attach = (inputId: string) => {
      const input = root.querySelector<HTMLInputElement>(`#${inputId}`);
      if (!input) return () => {};

      const onChange = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file || busyRef.current) return;

        busyRef.current = true;
        setSelectedName(file.name || "Selected photo");
        setError("");

        void processFile(file).finally(() => {
          busyRef.current = false;
          window.setTimeout(() => {
            target.value = "";
          }, 300);
        });
      };

      input.addEventListener("change", onChange);
      return () => input.removeEventListener("change", onChange);
    };

    const cleanups = [attach(GALLERY_INPUT_ID), attach(CAMERA_INPUT_ID)];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [processFile]);

  return (
    <Card className="space-y-3">
      <div ref={rootRef}>
        <h3 className="font-semibold">Scan receipt</h3>
        <p className="mt-1 text-sm text-muted">
          Take a photo or upload an image to auto-fill items, tax, and tip.
        </p>

        {standalonePwa && (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            Open this page in Safari (not the home-screen app). Tap Share → Open in Safari.
          </p>
        )}

        {preview && (
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Receipt preview" className="max-h-48 w-full object-contain bg-black/5" />
          </div>
        )}

        {selectedName && (
          <p className="mt-3 rounded-lg bg-accent px-3 py-2 text-sm font-medium">
            Selected: {selectedName}
          </p>
        )}

        {status === "converting" && (
          <p className="mt-2 text-sm text-primary">Converting photo for upload…</p>
        )}
        {status === "scanning" && (
          <p className="mt-2 text-sm text-muted">Reading receipt — this usually takes a few seconds.</p>
        )}
        {status === "done" && (
          <p className="mt-2 text-sm text-green-600">Receipt scanned — items filled in below.</p>
        )}

        <div className="mt-4 space-y-3">
          <FileUploadZone
            inputId={GALLERY_INPUT_ID}
            label={mobile ? "Tap to choose from Photo Library" : "Tap to upload receipt image"}
          />

          {mobile && (
            <FileUploadZone
              inputId={CAMERA_INPUT_ID}
              label="Tap to take a new photo"
              capture="environment"
              variant="secondary"
            />
          )}

          <p className="text-xs leading-relaxed text-muted">
            Tap directly on the colored bar above — not the small “Choose File” text. Use Safari or
            Chrome (not Instagram/WhatsApp). Allow Photos access if iOS asks.
          </p>
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </div>
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
