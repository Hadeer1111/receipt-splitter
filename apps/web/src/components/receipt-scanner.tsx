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

const galleryInputClassName = cn(
  "block w-full cursor-pointer text-sm text-muted",
  "file:mr-0 file:w-full file:cursor-pointer file:rounded-xl file:border-0",
  "file:bg-primary file:px-4 file:py-3 file:text-sm file:font-semibold file:text-white",
  "file:transition file:hover:bg-primary-hover",
);

interface ReceiptScannerProps {
  onParsed: (result: ParsedReceipt) => void;
}

export function ReceiptScanner({ onParsed }: ReceiptScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraFallbackRef = useRef<HTMLInputElement>(null);

  const [mobile, setMobile] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
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

  function handleGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    void handleFile(file);
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

  function openCameraFallback() {
    setError("");
    cameraFallbackRef.current?.click();
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

      <input
        ref={cameraFallbackRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleGalleryChange}
      />

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

      {!showCamera && (
        <div className="space-y-3">
          {mobile && (
            <div className="flex gap-2">
              {supportsCameraApi ? (
                <Button
                  type="button"
                  className="min-h-[44px] w-full"
                  onClick={() => void openCamera()}
                  disabled={pickerDisabled}
                >
                  {openingCamera ? "Requesting access..." : "Take photo"}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="min-h-[44px] w-full"
                  onClick={openCameraFallback}
                  disabled={pickerDisabled}
                >
                  Take photo
                </Button>
              )}
            </div>
          )}

          <div
            className={cn(
              "rounded-xl border border-border bg-background p-3",
              pickerDisabled && "pointer-events-none opacity-50",
            )}
          >
            {mobile && (
              <p className="mb-2 text-center text-sm font-semibold">Choose photo</p>
            )}
            <input
              type="file"
              accept="image/*"
              disabled={pickerDisabled}
              className={galleryInputClassName}
              style={{ fontSize: 16 }}
              onChange={handleGalleryChange}
            />
            {!mobile && (
              <p className="mt-2 text-center text-xs text-muted">
                {loading ? "Reading receipt..." : preview ? "Pick another image to scan again" : "Select a receipt image from your device"}
              </p>
            )}
          </div>
        </div>
      )}

      {mobile && !showCamera && (
        <p className="text-xs text-muted">
          Tap the button above to pick from your photo library. Your browser may ask for access.
        </p>
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
