import { AlertCircle, Camera, CheckCircle2, Loader2, RefreshCw, ScanFace } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

export type FaceCameraHandle = {
  capture: () => string | null;
  captureMultiple: (count?: number) => Promise<string[]>;
};

type CameraState = "idle" | "requesting" | "ready" | "denied" | "unavailable";

type Props = {
  isScanning?: boolean;
  onStateChange?: (state: CameraState) => void;
  mirror?: boolean;
};

const FaceCamera = forwardRef<FaceCameraHandle, Props>(function FaceCamera(
  { isScanning = false, onStateChange, mirror = true },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");

  const updateState = useCallback(
    (next: CameraState) => {
      setState(next);
      onStateChange?.(next);
    },
    [onStateChange]
  );

  // Stop camera tracks and clean up
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = async () => {
    // Stop any existing stream before starting a new one
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      updateState("unavailable");
      return;
    }

    updateState("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      updateState("ready");
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      updateState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
    }
  };

  const capture = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || state !== "ready" || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    const canvas = document.createElement("canvas");
    const outputSize = 720;
    canvas.width = outputSize;
    canvas.height = outputSize;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    // Crop center square out of video source
    const size = Math.min(video.videoWidth, video.videoHeight);
    const sourceX = (video.videoWidth - size) / 2;
    const sourceY = (video.videoHeight - size) / 2;

    // Handle horizontal flipping if video feed is mirrored
    if (mirror) {
      context.translate(outputSize, 0);
      context.scale(-1, 1);
    }

    context.drawImage(video, sourceX, sourceY, size, size, 0, 0, outputSize, outputSize);
    return canvas.toDataURL("image/jpeg", 0.88);
  }, [state, mirror]);

  const captureMultiple = useCallback(
    async (count = 3): Promise<string[]> => {
      const frames: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const frame = capture();
        if (!frame) break;
        frames.push(frame);

        if (i < count - 1) {
          await new Promise((resolve) => setTimeout(resolve, 180));
        }
      }
      return frames;
    },
    [capture]
  );

  useImperativeHandle(ref, () => ({ capture, captureMultiple }), [capture, captureMultiple]);

  // Clean up media stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const statusMap = {
    idle: { label: "Camera permission required", icon: Camera, tone: "neutral" },
    requesting: { label: "Requesting camera access…", icon: Loader2, tone: "neutral" },
    ready: { label: "Camera ready · align your face", icon: CheckCircle2, tone: "success" },
    denied: { label: "Camera permission denied", icon: AlertCircle, tone: "error" },
    unavailable: { label: "Camera unavailable on this device", icon: AlertCircle, tone: "error" },
  } as const;

  const currentStatus = statusMap[state];
  const StatusIcon = currentStatus.icon;

  return (
    <div className="camera-module">
      <div className="camera-viewport">
        <video
          ref={videoRef}
          className={`camera-video ${state === "ready" ? "is-live" : ""} ${mirror ? "is-mirrored" : ""}`}
          playsInline
          muted
          aria-label="Camera preview"
        />
        <div className="camera-shade" />

        <div
          className={`face-guide ${state === "ready" ? "is-active" : ""} ${isScanning ? "is-scanning" : ""}`}
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
          <span />
        </div>

        {state === "ready" && (
          <div className={`camera-scan-pattern ${isScanning ? "is-verifying" : ""}`} aria-hidden="true">
            <span className="scan-line" />
            <span className="scan-grid" />
            <span className="scan-pulse scan-pulse-one" />
            <span className="scan-pulse scan-pulse-two" />
          </div>
        )}

        {state !== "ready" && (
          <div className="camera-placeholder">
            <div className="camera-placeholder-icon">
              <ScanFace size={28} />
            </div>
            <p>{state === "idle" ? "Your camera preview will appear here" : currentStatus.label}</p>
          </div>
        )}

        <div className="camera-label" aria-live="polite">
          <span className={`live-dot ${state === "ready" ? "is-active" : ""}`} />
          {isScanning ? "SCANNING FACE" : "PRIVATE CAMERA FEED"}
        </div>
      </div>

      <div className={`camera-status ${currentStatus.tone}`} role="status">
        <StatusIcon size={16} className={state === "requesting" ? "animate-spin" : ""} />
        <span>{currentStatus.label}</span>
      </div>

      <p className="camera-hint">
        Keep one face inside the frame. A few still frames are sent only when you submit — never a live video stream.
      </p>

      {state !== "ready" && (
        <button
          type="button"
          className="text-button"
          disabled={state === "requesting"}
          onClick={() => void startCamera()}
        >
          {state === "idle" ? (
            "Enable camera"
          ) : (
            <>
              <RefreshCw size={14} className="mr-1 inline" /> Try camera again
            </>
          )}
        </button>
      )}
    </div>
  );
});

export default FaceCamera;