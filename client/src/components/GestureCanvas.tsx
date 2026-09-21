import { BookOpen, Download, Eraser, Hand, Loader2, RotateCcw, Save, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { gestureApi, type GestureResult, type GestureWork, type Stroke } from "../services/gestureApi";

type Props = { onStatus?: (message: string) => void };

const emptyWork: GestureWork = { strokes: [], transcript: [], lastGesture: "NO_HAND" };
const labels: Record<string, string> = {
  NO_HAND: "No hand",
  OPEN_PALM: "Open palm",
  FIST: "Fist",
  POINT: "Point",
  PINCH: "Pinch to draw",
  THUMBS_UP: "Thumbs up",
  VICTORY: "Victory",
  HAND: "Hand",
};

export default function GestureCanvas({ onStatus }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<MediaStream | null>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const artRef = useRef<HTMLCanvasElement>(null);
  const resultRef = useRef<GestureResult>({ gesture: "NO_HAND", confidence: 0, landmarks: [], handedness: null });
  const lastCommandRef = useRef({ gesture: "", at: 0 });
  const workRef = useRef<GestureWork>(emptyWork);
  const busyRef = useRef(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [result, setResult] = useState<GestureResult>(resultRef.current);
  const [work, setWork] = useState<GestureWork>(emptyWork);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateWork = useCallback((next: GestureWork) => {
    workRef.current = next;
    setWork(next);
  }, []);

  const redrawArt = useCallback((strokes: Stroke[]) => {
    const canvas = artRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";

    for (const stroke of strokes) {
      if (stroke.points.length === 0) continue;
      context.strokeStyle = stroke.color;
      context.fillStyle = stroke.color;
      context.lineWidth = stroke.width;

      if (stroke.points.length === 1) {
        const [x, y] = stroke.points[0];
        context.beginPath();
        context.arc(x * canvas.width, y * canvas.height, Math.max(3, stroke.width / 2), 0, Math.PI * 2);
        context.fill();
        continue;
      }

      context.beginPath();
      stroke.points.forEach(([x, y], index) => {
        if (index === 0) {
          context.moveTo(x * canvas.width, y * canvas.height);
        } else {
          context.lineTo(x * canvas.width, y * canvas.height);
        }
      });
      context.stroke();
    }
  }, []);

  const clearCanvas = useCallback(() => {
    updateWork({ ...workRef.current, strokes: [], lastGesture: "FIST" });
  }, [updateWork]);

  const undo = useCallback(() => {
    updateWork({
      ...workRef.current,
      strokes: workRef.current.strokes.slice(0, -1),
      lastGesture: "VICTORY",
    });
  }, [updateWork]);

  const save = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const saved = await gestureApi.saveWork(workRef.current);
      updateWork(saved);
      onStatus?.("Workspace saved to your account");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save workspace");
    } finally {
      setSaving(false);
    }
  }, [onStatus, updateWork]);

  const exportPng = useCallback(() => {
    const canvas = artRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "gesture-canvas-export.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  // Initial load
  useEffect(() => {
    let mounted = true;
    void gestureApi
      .getWork()
      .then((saved) => {
        if (mounted) {
          updateWork(saved);
          redrawArt(saved.strokes);
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [redrawArt, updateWork]);

  // Camera initialization
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        cameraRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
      } catch {
        setError("Camera access is required for gesture recognition.");
      }
    };
    void startCamera();
    return () => {
      cameraRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Gesture Recognition Polling Loop
  useEffect(() => {
    let mounted = true;
    const timer = window.setInterval(async () => {
      const video = videoRef.current;
      if (!mounted || busyRef.current || !video || video.readyState < 2 || video.videoWidth === 0) return;

      busyRef.current = true;
      const capture = document.createElement("canvas");
      capture.width = 960;
      capture.height = 540;
      const ctx = capture.getContext("2d", { willReadFrequently: true });
      ctx?.drawImage(video, 0, 0, capture.width, capture.height);

      try {
        const next = await gestureApi.recognize(capture.toDataURL("image/jpeg", 0.8));
        if (!mounted) return;

        resultRef.current = next;
        setResult(next);

        const now = Date.now();
        const previous = lastCommandRef.current;

        if (next.confidence >= 0.62 && next.gesture !== "NO_HAND" && (next.gesture !== previous.gesture || now - previous.at > 1800)) {
          lastCommandRef.current = { gesture: next.gesture, at: now };
          if (next.gesture === "FIST") clearCanvas();
          if (next.gesture === "VICTORY") undo();
          if (next.gesture === "THUMBS_UP") void save();
          if (next.gesture !== "PINCH" && next.gesture !== "FIST" && next.gesture !== "VICTORY" && next.gesture !== "THUMBS_UP") {
            updateWork({
              ...workRef.current,
              transcript: [...workRef.current.transcript, next.gesture].slice(-100),
              lastGesture: next.gesture,
            });
          }
        }
      } catch (nextError) {
        if (mounted) setError(nextError instanceof Error ? nextError.message : "Gesture recognition unavailable");
      } finally {
        busyRef.current = false;
      }
    }, 200);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [clearCanvas, save, undo, updateWork]);

  // Landmark & Pinch Stroke Renderer Loop
  useEffect(() => {
    const overlay = overlayRef.current;
    const art = artRef.current;
    if (!overlay || !art) return;

    overlay.width = art.width = 960;
    overlay.height = art.height = 540;

    const context = overlay.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, overlay.width, overlay.height);
    const points = result.landmarks;

    if (points.length === 21) {
      context.fillStyle = "#b7ded5";
      context.strokeStyle = "rgba(183, 222, 213, 0.72)";
      context.lineWidth = 2;

      const links = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [5, 9], [9, 10], [10, 11], [11, 12],
        [9, 13], [13, 14], [14, 15], [15, 16],
        [13, 17], [17, 18], [18, 19], [19, 20],
        [0, 17],
      ];

      links.forEach(([a, b]) => {
        context.beginPath();
        context.moveTo((1 - points[a].x) * 960, points[a].y * 540);
        context.lineTo((1 - points[b].x) * 960, points[b].y * 540);
        context.stroke();
      });

      points.forEach((point) => {
        context.beginPath();
        context.arc((1 - point.x) * 960, point.y * 540, 4, 0, Math.PI * 2);
        context.fill();
      });

      if (result.gesture === "PINCH" && result.confidence >= 0.62) {
        const tip = points[8];
        const x = 1 - tip.x;
        const y = tip.y;
        const previous = workRef.current.strokes.at(-1);
        const nextPoint: [number, number] = [x, y];

        if (previous && previous.color === "#e76e43" && previous.points.length > 0) {
          updateWork({
            ...workRef.current,
            strokes: [
              ...workRef.current.strokes.slice(0, -1),
              { ...previous, points: [...previous.points, nextPoint] },
            ],
            lastGesture: "PINCH",
          });
        } else {
          updateWork({
            ...workRef.current,
            strokes: [...workRef.current.strokes, { points: [nextPoint], color: "#e76e43", width: 7 }],
            lastGesture: "PINCH",
          });
        }
        redrawArt(workRef.current.strokes);
      }
    }
  }, [redrawArt, result, updateWork]);

  useEffect(() => {
    redrawArt(work.strokes);
  }, [redrawArt, work.strokes]);

  return (
    <section className="gesture-workspace">
      <div className="gesture-workspace-heading">
        <div>
          <span className="section-kicker">PHASE 02 · HAND LANGUAGE</span>
          <h2>
            Make a mark with your <em>hands.</em>
          </h2>
          <p>
            Keep your hand inside the camera frame. Your artwork stays on the canvas when tracking pauses or your hand
            leaves the frame.
          </p>
        </div>
        <div className={`gesture-status ${cameraReady ? "live" : ""}`}>
          <span /> {cameraReady ? "LIVE RECOGNITION" : "STARTING CAMERA"}
        </div>
      </div>

      <div className="gesture-help">
        <div className="gesture-help-title">
          <BookOpen size={17} />
          <strong>How to use the hand canvas</strong>
        </div>
        <div className="gesture-help-steps">
          <span>
            <b>1</b>
            <strong>Pinch</strong>
            <small>Draw with index finger</small>
          </span>
          <span>
            <b>2</b>
            <strong>Fist</strong>
            <small>Clear canvas</small>
          </span>
          <span>
            <b>3</b>
            <strong>Victory</strong>
            <small>Undo stroke</small>
          </span>
          <span>
            <b>4</b>
            <strong>Thumbs up</strong>
            <small>Save workspace</small>
          </span>
        </div>
      </div>

      <div className="gesture-grid">
        {/* Camera View Card */}
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
            <div className="gesture-guide">Place one hand inside the frame</div>
            <div className="gesture-camera-label">
              <Hand size={14} /> Hand tracking camera
            </div>
          </div>

          <div className="gesture-readout">
            <div className="gesture-readout-icon">
              <Hand size={19} />
            </div>
            <div>
              <span>DETECTED GESTURE</span>
              <strong>{labels[result.gesture] ?? result.gesture}</strong>
            </div>
            <b>{Math.round(result.confidence * 100)}%</b>
          </div>

          <div className="gesture-actions">
            <button className="button button-ghost" onClick={clearCanvas}>
              <Eraser size={15} /> Clear
            </button>
            <button className="button button-ghost" onClick={undo}>
              <RotateCcw size={15} /> Undo
            </button>
            <button className="button button-ghost" onClick={exportPng}>
              <Download size={15} /> PNG
            </button>
            <button className="button button-primary" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
              {saving ? "Saving" : "Save"}
            </button>
          </div>
        </div>

        {/* Canvas Output Card */}
        <div className="gesture-art-card">
          <div className="gesture-art-head">
            <div>
              <span className="section-kicker">YOUR CANVAS</span>
              <h3>Gesture trace</h3>
            </div>
            <Sparkles size={17} />
          </div>

          <div
            className="gesture-art"
            style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", overflow: "hidden", borderRadius: "8px" }}
          >
            <canvas ref={artRef} style={{ width: "100%", height: "100%", display: "block" }} />
          </div>

          <div className="gesture-transcript">
            <span>RECENT SIGNALS</span>
            <div>
              {work.transcript.slice(-8).map((item, index) => (
                <b key={`${item}-${index}`}>{labels[item] ?? item}</b>
              ))}
              {work.transcript.length === 0 && <small>Recognized gestures will appear here.</small>}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="gesture-error">
          <Trash2 size={15} /> {error}
        </div>
      )}
    </section>
  );
}