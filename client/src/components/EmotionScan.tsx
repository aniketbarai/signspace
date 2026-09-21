import { ScanFace } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFaceLandmarker } from "../hooks/useFaceLandmarker";
import { EMOTION_NAMES } from "../lib/emotionClassifier";
import type { EmotionName } from "../lib/emotionClassifier";
import { EMOTION_COLORS, EMOTION_ICONS, FACE_CONNECTION_SETS, faceBoundingBox } from "../lib/emotionVisuals";

const CANVAS_W = 960;
const CANVAS_H = 540;

export default function EmotionScan() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<MediaStream | null>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const lastEmotionRef = useRef<{ name: EmotionName; at: number } | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState("");
  const [emotionHistory, setEmotionHistory] = useState<EmotionName[]>([]);

  const { result: faceResult, ready: faceReady, loadError } = useFaceLandmarker(videoRef, cameraReady);

  // Camera lifecycle: this screen owns its own stream, independent of the
  // Hand Canvas tab, so switching tabs starts/stops the right camera only.
  useEffect(() => {
    let cancelled = false;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
      } catch {
        if (!cancelled) setError("Camera access is required for emotion detection.");
      }
    };
    void startCamera();
    return () => {
      cancelled = true;
      cameraRef.current?.getTracks().forEach((track) => track.stop());
      cameraRef.current = null;
      setCameraReady(false);
    };
  }, []);

  useEffect(() => {
    if (loadError) setError(loadError);
  }, [loadError]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (overlay) {
      overlay.width = CANVAS_W;
      overlay.height = CANVAS_H;
    }
  }, []);

  // Face scan overlay: draws a glowing "faceprint" contour, corner brackets,
  // and a sweeping scan line whenever a face is present.
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (!faceResult.present || faceResult.landmarks.length === 0) return;

    const points = faceResult.landmarks;
    const box = faceBoundingBox(points);
    const toX = (nx: number) => (1 - nx) * CANVAS_W;
    const toY = (ny: number) => ny * CANVAS_H;

    const accent = "rgba(183, 222, 213, 0.85)";
    const glow = "rgba(183, 222, 213, 0.35)";

    // Glowing mesh contour
    context.lineWidth = 1.3;
    context.strokeStyle = accent;
    context.shadowColor = glow;
    context.shadowBlur = 6;
    for (const set of FACE_CONNECTION_SETS) {
      context.beginPath();
      for (const [a, b] of set) {
        const pa = points[a];
        const pb = points[b];
        if (!pa || !pb) continue;
        context.moveTo(toX(pa.x), toY(pa.y));
        context.lineTo(toX(pb.x), toY(pb.y));
      }
      context.stroke();
    }
    context.shadowBlur = 0;

    // Fine landmark dots (sampled, not all 478, to keep it a "print" not a blur)
    context.fillStyle = "rgba(200, 227, 223, 0.55)";
    for (let index = 0; index < points.length; index += 4) {
      const point = points[index];
      context.beginPath();
      context.arc(toX(point.x), toY(point.y), 1.1, 0, Math.PI * 2);
      context.fill();
    }

    // Bounding box + corner brackets, biometric-scanner style
    const bx = toX(box.maxX);
    const by = toY(box.minY);
    const bw = toX(box.minX) - toX(box.maxX);
    const bh = toY(box.maxY) - toY(box.minY);
    const bracket = Math.min(bw, bh) * 0.16;
    context.strokeStyle = "rgba(231, 110, 67, 0.85)";
    context.lineWidth = 2.4;
    const corners: [number, number, number, number][] = [
      [bx, by, 1, 1],
      [bx + bw, by, -1, 1],
      [bx, by + bh, 1, -1],
      [bx + bw, by + bh, -1, -1],
    ];
    for (const [cx, cy, dx, dy] of corners) {
      context.beginPath();
      context.moveTo(cx, cy + bracket * dy);
      context.lineTo(cx, cy);
      context.lineTo(cx + bracket * dx, cy);
      context.stroke();
    }

    // Sweeping scan line, driven by wall-clock time so it animates smoothly
    // even between tracker frames.
    const phase = (performance.now() % 2200) / 2200;
    const scanY = by + bh * phase;
    const gradient = context.createLinearGradient(bx, 0, bx + bw, 0);
    gradient.addColorStop(0, "rgba(231, 110, 67, 0)");
    gradient.addColorStop(0.5, "rgba(231, 110, 67, 0.9)");
    gradient.addColorStop(1, "rgba(231, 110, 67, 0)");
    context.strokeStyle = gradient;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(bx, scanY);
    context.lineTo(bx + bw, scanY);
    context.stroke();

    const trailGradient = context.createLinearGradient(bx, scanY - 26, bx, scanY);
    trailGradient.addColorStop(0, "rgba(231, 110, 67, 0)");
    trailGradient.addColorStop(1, "rgba(231, 110, 67, 0.12)");
    context.fillStyle = trailGradient;
    context.fillRect(bx, Math.max(by, scanY - 26), bw, Math.min(26, scanY - by));
  }, [faceResult]);

  // Debounced history of dominant-emotion changes.
  useEffect(() => {
    if (!faceResult.present) return;
    const { dominant, confidence } = faceResult.emotion;
    if (confidence < 0.06) return;
    const previous = lastEmotionRef.current;
    const now = Date.now();
    if (!previous || previous.name !== dominant) {
      if (!previous || now - previous.at > 700) {
        lastEmotionRef.current = { name: dominant, at: now };
        setEmotionHistory((prev) => [...prev.slice(-7), dominant]);
      }
    }
  }, [faceResult]);

  return (
    <section className="gesture-workspace">
      <div className="gesture-workspace-heading">
        <div>
          <span className="section-kicker">PHASE 02 · LIVE EMOTION</span>
          <h2>
            Read your <em>expression.</em>
          </h2>
          <p>Keep your face inside the camera frame. Your expression is scanned continuously and turned into live emotion scores.</p>
        </div>
        <div className={`gesture-status ${cameraReady && faceReady ? "live" : ""}`}>
          <span /> {cameraReady && faceReady ? `LIVE · ${faceResult.fps || 0} FPS` : "STARTING CAMERA"}
        </div>
      </div>

      <div className="gesture-grid emotion-scan-grid">
        <div className="gesture-camera-card">
          <div
            className="gesture-camera"
            style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", overflow: "hidden", borderRadius: "8px" }}
          >
            <video
              ref={videoRef}
              muted
              playsInline
              className={cameraReady ? "live" : ""}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <canvas
              ref={overlayRef}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
            />
            <div className="face-scan-label">
              <ScanFace size={13} /> {faceResult.present ? "Face locked" : faceReady ? "Scanning for a face…" : "Loading face model…"}
            </div>
          </div>
        </div>

        <div className="gesture-art-card emotion-panel-card">
          <div className="gesture-art-head">
            <div>
              <span className="section-kicker">EMOTION READOUT</span>
              <h3>Live scores</h3>
            </div>
          </div>

          <div className="emotion-panel">
            <div className="emotion-panel-head">
              <div className="emotion-readout-icon" style={{ color: EMOTION_COLORS[faceResult.emotion.dominant] }}>
                {(() => {
                  const Icon = EMOTION_ICONS[faceResult.emotion.dominant];
                  return <Icon size={18} />;
                })()}
              </div>
              <div>
                <span>EMOTION DETECTED</span>
                <strong>{faceResult.present ? faceResult.emotion.dominant : "No face"}</strong>
              </div>
              <b>{faceResult.present ? `${Math.round(faceResult.emotion.scores[faceResult.emotion.dominant] * 100)}%` : "—"}</b>
            </div>
            <div className="emotion-bars">
              {EMOTION_NAMES.map((name) => {
                const score = faceResult.present ? faceResult.emotion.scores[name] : 0;
                return (
                  <div className="emotion-bar-row" key={name}>
                    <span>{name}</span>
                    <div className="emotion-bar-track">
                      <div
                        className="emotion-bar-fill"
                        style={{ width: `${Math.round(score * 100)}%`, background: EMOTION_COLORS[name] }}
                      />
                    </div>
                    <b>{Math.round(score * 100)}</b>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="gesture-transcript">
            <span>RECENT EMOTIONS</span>
            <div>
              {emotionHistory.map((name, index) => (
                <b key={`${name}-${index}`} style={{ color: EMOTION_COLORS[name], background: "rgba(0,0,0,0.04)" }}>
                  {name}
                </b>
              ))}
              {emotionHistory.length === 0 && <small>Expression changes will appear here.</small>}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="gesture-error">
          <ScanFace size={15} /> {error}
        </div>
      )}
    </section>
  );
}
