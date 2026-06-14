"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { parseReceipt, ApiError } from "@/lib/api";
import { normalizeReceiptImage } from "@/lib/normalize-image";
import type { ParsedReceipt } from "@/lib/types";
import { Button, Card } from "@/components/ui";
import { cn, formatDollarsInput } from "@/lib/utils";

function isMobileDevice() {
  if (typeof window === "undefined") return false;
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && window.matchMedia("(max-width: 768px)").matches)
  );
}

interface ReceiptScannerProps {
  onParsed: (result: ParsedReceipt) => void;
}

type ScanStatus = "idle" | "converting" | "scanning" | "done" | "error";

export function ReceiptScanner({ onParsed }: ReceiptScannerProps) {
  const galleryInputId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mobile, setMobile] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [error, setError] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [openingCamera, setOpeningCamera] = useState(false);

  const stopCameraStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    setMobile(isMobileDevice());
    return () => stopCameraStream();
  }, [stopCameraStream]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!showCamera || !video || !stream) return;

    video.srcObject = stream;
    void video.play().catch(() => {});
  }, [showCamera]);

  async function handleGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

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
    } finally {
      e.target.value = "";
    }
  }

  const pickerDisabled = status === "converting" || status === "scanning" || openingCamera || showCamera;
  const supportsCameraApi = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  async function openCamera() {
    setError("");
    setOpeningCamera(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setShowCamera(true);
    } catch (err) {
      const denied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      setError(
        denied
          ? "Camera access was blocked. Enable it in your browser or device settings, then try again."
          : "Could not open the camera. Try choosing a photo from your library instead.",
      );
    } finally {
      setOpeningCamera(false);
    }
  }

  function cancelCamera() {
    stopCameraStream();
    setShowCamera(false);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    stopCameraStream();
    setShowCamera(false);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) return;

    const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: "image/jpeg" });
    setSelectedName(file.name);
    setStatus("scanning");
    setPreview(URL.createObjectURL(file));
    setError("");

    try {
      const result = await parseReceipt(file);
      onParsed(result);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "Failed to scan receipt");
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

      {showCamera && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-border bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-[3/4] w-full object-cover"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={cancelCamera}>
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={() => void capturePhoto()}
              disabled={status === "scanning"}
            >
              Capture
            </Button>
          </div>
        </div>
      )}

      {preview && !showCamera && (
        <div className="overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Receipt preview" className="max-h-48 w-full object-contain bg-black/5" />
        </div>
      )}

      {selectedName && !showCamera && (
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

      {!showCamera && (
        <div className="space-y-3">
          {mobile && supportsCameraApi && (
            <Button
              type="button"
              className="min-h-[48px] w-full"
              onClick={() => void openCamera()}
              disabled={pickerDisabled}
            >
              {openingCamera ? "Requesting access..." : "Take photo with camera"}
            </Button>
          )}

          <div className="rounded-xl border-2 border-primary/40 bg-background p-4">
            <label
              htmlFor={galleryInputId}
              className="mb-3 block cursor-pointer text-center text-sm font-semibold text-primary"
            >
              {mobile ? "Choose photo from library" : "Upload receipt image"}
            </label>

            <input
              id={galleryInputId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
              disabled={pickerDisabled}
              onChange={(e) => void handleGalleryChange(e)}
              className="block w-full min-w-0 cursor-pointer text-base"
              style={{ fontSize: 16, minHeight: 48 }}
            />

            {mobile && (
              <p className="mt-3 text-center text-xs leading-relaxed text-muted">
                Tap the file button above (may say “Browse” or “Choose File”). Open this page in
                Safari or Chrome — in-app browsers often block photo uploads.
              </p>
            )}
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
