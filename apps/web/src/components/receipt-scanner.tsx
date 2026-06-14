"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseReceipt, ApiError } from "@/lib/api";
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

function GalleryPicker({
  disabled,
  onSelect,
  label,
  hint,
  capture,
}: {
  disabled?: boolean;
  onSelect: (file: File) => void;
  label: string;
  hint?: string;
  capture?: "environment" | "user";
}) {
  return (
    <div
      className={cn(
        "relative min-h-[120px] rounded-xl border-2 border-dashed border-primary/50 bg-background",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <input
        type="file"
        accept="image/*"
        capture={capture}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-[0.01]"
        style={{ fontSize: 16, touchAction: "manipulation" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onSelect(file);
        }}
      />
      <div className="pointer-events-none flex min-h-[120px] flex-col items-center justify-center px-4 py-6 text-center">
        <p className="font-semibold text-primary">{label}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}

export function ReceiptScanner({ onParsed }: ReceiptScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mobile, setMobile] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [loading, setLoading] = useState(false);
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

  async function handleFile(file: File | null) {
    if (!file) return;
    setError("");
    setSelectedName(file.name || "Selected photo");

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

  const pickerDisabled = loading || openingCamera || showCamera;
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
    await handleFile(file);
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
            <Button type="button" className="flex-1" onClick={() => void capturePhoto()} disabled={loading}>
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
        <p className="text-sm text-muted">Selected: {selectedName}</p>
      )}

      {!showCamera && (
        <div className="space-y-3">
          {mobile && supportsCameraApi && (
            <Button
              type="button"
              className="min-h-[44px] w-full"
              onClick={() => void openCamera()}
              disabled={pickerDisabled}
            >
              {openingCamera ? "Requesting access..." : "Take photo with camera"}
            </Button>
          )}

          <GalleryPicker
            disabled={pickerDisabled}
            label={mobile ? "Tap to choose photo" : "Tap to upload receipt image"}
            hint={
              mobile
                ? "Opens your photo library — allow access if asked"
                : "Select a JPEG, PNG, or HEIC image"
            }
            onSelect={(file) => void handleFile(file)}
          />

          {mobile && !supportsCameraApi && (
            <GalleryPicker
              disabled={pickerDisabled}
              capture="environment"
              label="Tap to take photo"
              hint="Opens your camera — allow access if asked"
              onSelect={(file) => void handleFile(file)}
            />
          )}
        </div>
      )}

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
