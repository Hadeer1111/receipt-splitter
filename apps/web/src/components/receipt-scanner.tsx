"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseReceipt, ApiError } from "@/lib/api";
import type { ParsedReceipt } from "@/lib/types";
import { Button, Card } from "@/components/ui";
import { cn, formatDollarsInput } from "@/lib/utils";

const GALLERY_INPUT_ID = "receipt-gallery-input";
const CAMERA_CAPTURE_INPUT_ID = "receipt-camera-capture-input";

const buttonSecondaryClass =
  "inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition bg-card border border-border text-foreground hover:bg-accent";

interface ReceiptScannerProps {
  onParsed: (result: ParsedReceipt) => void;
}

function isMobileDevice() {
  if (typeof window === "undefined") return false;
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && window.matchMedia("(max-width: 768px)").matches)
  );
}

export function ReceiptScanner({ onParsed }: ReceiptScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mobile, setMobile] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [permissionNote, setPermissionNote] = useState("");
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
    setPermissionNote("");

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
    void handleFile(e.target.files?.[0] ?? null);
    e.target.value = "";
    setPermissionNote("");
  }

  function handleCameraCaptureChange(e: React.ChangeEvent<HTMLInputElement>) {
    void handleFile(e.target.files?.[0] ?? null);
    e.target.value = "";
    setPermissionNote("");
  }

  const pickerDisabled = loading || openingCamera || showCamera;
  const supportsCameraApi = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  async function openCamera() {
    setError("");
    setPermissionNote("Allow camera access when your browser asks — we only use it to scan your receipt.");

    setOpeningCamera(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setShowCamera(true);
      setPermissionNote("");
    } catch (err) {
      const denied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      setCameraError(
        denied
          ? "Camera access was blocked. Enable it in your browser or device settings, then try again."
          : "Could not open the camera. Try choosing a photo from your library instead.",
      );
      setPermissionNote("");
    } finally {
      setOpeningCamera(false);
    }
  }

  function setCameraError(message: string) {
    setError(message);
  }

  function cancelCamera() {
    stopCameraStream();
    setShowCamera(false);
    setPermissionNote("");
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
        id={GALLERY_INPUT_ID}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={pickerDisabled}
        onChange={handleGalleryChange}
      />
      <input
        id={CAMERA_CAPTURE_INPUT_ID}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={pickerDisabled}
        onChange={handleCameraCaptureChange}
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
        <div className="flex gap-2">
          {mobile ? (
            <>
              {supportsCameraApi ? (
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => void openCamera()}
                  disabled={pickerDisabled}
                >
                  {openingCamera ? "Requesting access..." : "Take photo"}
                </Button>
              ) : (
                <label
                  htmlFor={CAMERA_CAPTURE_INPUT_ID}
                  className={cn(
                    buttonSecondaryClass,
                    "flex-1 cursor-pointer",
                    pickerDisabled && "pointer-events-none opacity-50",
                  )}
                  onClick={() => {
                    setError("");
                    setPermissionNote("Allow camera access when prompted to take a receipt photo.");
                  }}
                >
                  Take photo
                </label>
              )}
              <label
                htmlFor={GALLERY_INPUT_ID}
                className={cn(
                  buttonSecondaryClass,
                  "flex-1 cursor-pointer",
                  pickerDisabled && "pointer-events-none opacity-50",
                )}
                onClick={() => {
                  setError("");
                  setPermissionNote("Allow photo library access when prompted to pick a receipt image.");
                }}
              >
                Choose photo
              </label>
            </>
          ) : (
            <label
              htmlFor={GALLERY_INPUT_ID}
              className={cn(
                buttonSecondaryClass,
                "flex-1 cursor-pointer bg-primary text-white hover:bg-primary-hover border-transparent",
                pickerDisabled && "pointer-events-none opacity-50",
              )}
              onClick={() => setError("")}
            >
              {loading ? "Reading receipt..." : preview ? "Scan another" : "Upload receipt image"}
            </label>
          )}
        </div>
      )}

      {permissionNote && (
        <p className="text-sm text-muted">{permissionNote}</p>
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
