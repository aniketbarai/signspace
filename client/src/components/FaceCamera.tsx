import { AlertCircle, Camera, CheckCircle2, Loader2, ScanFace } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type FaceCameraHandle = { capture: () => string | null; captureMultiple: (count?: number) => Promise<string[]> };
type CameraState = "idle" | "requesting" | "ready" | "denied" | "unavailable";

type Props = { onStateChange?: (state: CameraState) => void };

const FaceCamera = forwardRef<FaceCameraHandle, Props>(function FaceCamera({ onStateChange }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");

  const updateState = (next: CameraState) => {
    setState(next);
    onStateChange?.(next);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      updateState("unavailable");
      return;
    }
    updateState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
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

  const capture = () => {
      const video = videoRef.current;
      if (!video || state !== "ready" || video.videoWidth === 0) return null;
      const canvas = document.createElement("canvas");
      const size = Math.min(video.videoWidth, video.videoHeight);
      canvas.width = 720;
      canvas.height = 720;
      const context = canvas.getContext("2d");
      if (!context) return null;
      const sourceX = (video.videoWidth - size) / 2;
      const sourceY = (video.videoHeight - size) / 2;
      context.drawImage(video, sourceX, sourceY, size, size, 0, 0, 720, 720);
      return canvas.toDataURL("image/jpeg", 0.88);
  };

  const captureMultiple = async (count = 3) => {
    const frames: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const frame = capture();
      if (!frame) break;
      frames.push(frame);
      if (index < count - 1) await new Promise((resolve) => window.setTimeout(resolve, 180));
    }
    return frames;
  };

  useImperativeHandle(ref, () => ({ capture, captureMultiple }), [state]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const status = {
    idle: { label: "Camera permission required", icon: Camera, tone: "neutral" },
    requesting: { label: "Requesting camera access…", icon: Loader2, tone: "neutral" },
    ready: { label: "Camera ready · align your face", icon: CheckCircle2, tone: "success" },
    denied: { label: "Camera permission denied", icon: AlertCircle, tone: "error" },
    unavailable: { label: "Camera unavailable on this device", icon: AlertCircle, tone: "error" },
  }[state];
  const StatusIcon = status.icon;

  return (
    <div className="camera-module">
      <div className="camera-viewport">
        <video ref={videoRef} className={`camera-video ${state === "ready" ? "is-live" : ""}`} playsInline muted aria-label="Camera preview" />
        <div className="camera-shade" />
        <div className="face-guide"><span /><span /><span /><span /></div>
        {state !== "ready" && (
          <div className="camera-placeholder">
            <div className="camera-placeholder-icon"><ScanFace size={28} /></div>
            <p>{state === "idle" ? "Your camera preview will appear here" : status.label}</p>
          </div>
        )}
        <div className="camera-label"><span className="live-dot" /> PRIVATE CAMERA FEED</div>
      </div>
      <div className={`camera-status ${status.tone}`}>
        <StatusIcon size={16} className={state === "requesting" ? "spin" : ""} />
        <span>{status.label}</span>
      </div>
      <p className="camera-hint">Keep one face inside the frame. A few still frames are sent only when you submit — never a live video stream.</p>
      {state !== "ready" && <button type="button" className="text-button" onClick={() => void startCamera()}>{state === "idle" ? "Enable camera" : "Try camera again"}</button>}
    </div>
  );
});

export default FaceCamera;
