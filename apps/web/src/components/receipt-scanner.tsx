"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseReceipt, ApiError } from "@/lib/api";
import { normalizeReceiptImage } from "@/lib/normalize-image";
import type { ParsedReceipt } from "@/lib/types";
import { Card } from "@/components/ui";
import { formatDollarsInput } from "@/lib/utils";

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

/**
 * iOS Safari often ignores React's synthetic onChange for file inputs (especially
 * Photo Library). Native addEventListener is the reliable fix per WebKit bugs.
 */
function useNativeFileInput(onFile: (file: File) => void | Promise<void>, enabled = true) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onFileRef = useRef(onFile);
  const busyRef = useRef(false);

  useEffect(() => {
    onFileRef.current = onFile;
  }, [onFile]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || !enabled) return;

    const handleSelection = (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file || busyRef.current) return;

      busyRef.current = true;
      const selected = file;

      queueMicrotask(() => {
        void Promise.resolve(onFileRef.current(selected))
          .catch(() => {})
          .finally(() => {
            target.value = "";
            busyRef.current = false;
          });
      });
    };

    input.addEventListener("change", handleSelection);
    input.addEventListener("input", handleSelection);

    return () => {
      input.removeEventListener("change", handleSelection);
      input.removeEventListener("input", handleSelection);
    };
  }, [enabled]);

  return inputRef;
}

interface ReceiptScannerProps {
  onParsed: (result: ParsedReceipt) => void;
}

type ScanStatus = "idle" | "converting" | "scanning" | "done" | "error";

export function ReceiptScanner({ onParsed }: ReceiptScannerProps) {
  const [mobile, setMobile] = useState(false);
  const [standalonePwa, setStandalonePwa] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    setMobile(isMobileDevice());
    setStandalonePwa(isStandalonePwa());
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      setError("");
      setSelectedName(file.name || "Selected photo");
      setStatus("converting");

      try {
        const normalized = await normalizeReceiptImage(file);
        setPreview(URL.createObjectURL(normalized));
        setStatus("scanning");

        const result = await parseReceipt(normalized);
        onParsed(result);
        setStatus("done");
      } catch (err) {
        setStatus("error");
        setError(err instanceof ApiError ? err.message : "Failed to scan receipt");
      }
    },
    [onParsed],
  );

  const busy = status === "converting" || status === "scanning";
  const galleryRef = useNativeFileInput(processFile, !busy);
  const cameraRef = useNativeFileInput(processFile, !busy);

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="font-semibold">Scan receipt</h3>
        <p className="text-sm text-muted">
          Take a photo or upload an image to auto-fill items, tax, and tip.
        </p>
      </div>

      {standalonePwa && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          iOS home-screen apps can break photo uploads. If nothing happens, open this page in
          Safari instead: tap Share → Open in Safari.
        </p>
      )}

      {preview && (
        <div className="overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Receipt preview" className="max-h-48 w-full object-contain bg-black/5" />
        </div>
      )}

      {selectedName && (
        <p className="rounded-lg bg-accent px-3 py-2 text-sm font-medium">
          Selected: {selectedName}
        </p>
      )}

      {status === "converting" && (
        <p className="text-sm text-primary">Converting photo for upload…</p>
      )}
      {status === "scanning" && (
        <p className="text-sm text-muted">Reading receipt — this usually takes a few seconds.</p>
      )}
      {status === "done" && (
        <p className="text-sm text-green-600">Receipt scanned — items filled in below.</p>
      )}

      <div className="space-y-3">
        {mobile ? (
          <>
            <label className="block cursor-pointer rounded-xl border-2 border-primary bg-background p-4">
              <span className="mb-3 block text-center text-sm font-semibold text-primary">
                1. Photo library
              </span>
              <input
                ref={galleryRef}
                type="file"
                name="receipt-gallery"
                accept="image/*"
                className="block w-full cursor-pointer"
                style={{ fontSize: 16, minHeight: 48, width: "100%" }}
              />
              <span className="mt-2 block text-center text-xs text-muted">
                Tap above, then choose Photo Library
              </span>
            </label>

            <label className="block cursor-pointer rounded-xl border border-border bg-background p-4">
              <span className="mb-3 block text-center text-sm font-semibold">
                2. Take new photo
              </span>
              <input
                ref={cameraRef}
                type="file"
                name="receipt-camera"
                accept="image/*"
                capture="environment"
                className="block w-full cursor-pointer"
                style={{ fontSize: 16, minHeight: 48, width: "100%" }}
              />
              <span className="mt-2 block text-center text-xs text-muted">
                Tap above, then choose Take Photo
              </span>
            </label>
          </>
        ) : (
          <label className="block cursor-pointer rounded-xl border-2 border-primary bg-background p-4">
            <span className="mb-3 block text-center text-sm font-semibold text-primary">
              Upload receipt image
            </span>
            <input
              ref={galleryRef}
              type="file"
              name="receipt-upload"
              accept="image/*"
              className="block w-full cursor-pointer"
              style={{ fontSize: 16, minHeight: 48, width: "100%" }}
            />
          </label>
        )}

        {mobile && (
          <p className="text-xs leading-relaxed text-muted">
            Use Safari or Chrome directly — not Instagram/WhatsApp. If the picker never opens,
            check Settings → Safari → Photos → Allow.
          </p>
        )}
      </div>

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
