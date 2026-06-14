"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseReceipt, ApiError } from "@/lib/api";
import { normalizeReceiptImage } from "@/lib/normalize-image";
import type { ParsedReceipt } from "@/lib/types";
import { Button, Card } from "@/components/ui";
import { formatDollarsInput } from "@/lib/utils";

interface ReceiptScannerProps {
  onParsed: (result: ParsedReceipt) => void;
}

type ScanStatus = "idle" | "converting" | "scanning" | "done" | "error";

export function ReceiptScanner({ onParsed }: ReceiptScannerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onParsedRef = useRef(onParsed);
  const busyRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [error, setError] = useState("");
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    onParsedRef.current = onParsed;
  }, [onParsed]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!showCamera || !video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
  }, [showCamera]);

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

  // Safari: bind native change listener directly on the input ref (not React onChange)
  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;

    const onNativeChange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file || busyRef.current) return;

      busyRef.current = true;
      void processFile(file).finally(() => {
        busyRef.current = false;
        window.setTimeout(() => {
          target.value = "";
        }, 500);
      });
    };

    input.addEventListener("change", onNativeChange);
    return () => input.removeEventListener("change", onNativeChange);
  }, [processFile]);

  async function startLiveCamera() {
    setError("");
    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setShowCamera(true);
    } catch {
      setError(
        "Camera blocked. Allow camera for this site in Settings → Safari → Camera, or use the file picker below.",
      );
    }
  }

  async function captureFromCamera() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    stopCamera();
    setShowCamera(false);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) return;

    await processFile(new File([blob], `receipt-${Date.now()}.jpg`, { type: "image/jpeg" }));
  }

  const busy = status === "converting" || status === "scanning";

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="font-semibold">Scan receipt</h3>
        <p className="mt-1 text-sm text-muted">
          Upload a receipt photo to auto-fill items, tax, and tip.
        </p>
      </div>

      {preview && !showCamera && (
        <div className="overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Receipt preview" className="max-h-48 w-full object-contain bg-black/5" />
        </div>
      )}

      {selectedName && (
        <p className="rounded-lg bg-accent px-3 py-2 text-sm font-medium">Selected: {selectedName}</p>
      )}

      {status === "converting" && <p className="text-sm text-primary">Preparing photo…</p>}
      {status === "scanning" && (
        <p className="text-sm text-muted">Reading receipt — usually takes a few seconds.</p>
      )}
      {status === "done" && (
        <p className="text-sm text-green-600">Receipt scanned — items filled in below.</p>
      )}

      {showCamera ? (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-border bg-black">
            <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full object-cover" />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                stopCamera();
                setShowCamera(false);
              }}
            >
              Cancel
            </Button>
            <Button type="button" className="flex-1" onClick={() => void captureFromCamera()} disabled={busy}>
              Capture
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Button
            type="button"
            className="min-h-[48px] w-full"
            onClick={() => void startLiveCamera()}
            disabled={busy}
          >
            Open camera
          </Button>

          <div className="rounded-xl border-2 border-dashed border-primary/60 bg-background p-4">
            <p className="mb-3 text-center text-sm font-semibold text-primary">
              Or pick a photo from your device
            </p>

            {/* Fully visible native input — required for Safari (no hidden overlays) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              name="receipt-image"
              style={{
                display: "block",
                width: "100%",
                minHeight: 48,
                fontSize: 18,
                cursor: "pointer",
              }}
            />

            <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted">
              <li>Tap the button above (may say “Choose File” or show a photo icon).</li>
              <li>Pick <strong>Photo Library</strong> or <strong>Take Photo</strong>.</li>
              <li>Select your receipt, then tap <strong>Add</strong> or <strong>Done</strong>.</li>
            </ol>
          </div>
        </div>
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
