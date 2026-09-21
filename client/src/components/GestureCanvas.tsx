import {
  BookOpen,
  Download,
  Eraser,
  FolderOpen,
  Hand,
  Loader2,
  Redo2,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { HAND_CONNECTIONS } from "../lib/handGestures";
import { useHandLandmarker } from "../hooks/useHandLandmarker";
import { gestureApi, localWork, type GestureWork, type Stroke } from "../services/gestureApi";
import GestureGalleryModal from "./GestureGalleryModal";

type Props = { onStatus?: (message: string) => void; initialGalleryOpen?: boolean };

const CANVAS_W = 960;
const CANVAS_H = 540;
const emptyWork: GestureWork = { strokes: [], transcript: [], lastGesture: "NO_HAND" };
const PALETTE = ["#e76e43", "#2e716e", "#1d2626", "#c8408f", "#3068c9", "#f2b705"];
const GESTURE_HOLD_MS = 900; // how long a command gesture (fist/victory/etc) must be steady before it fires
const PINCH_JUMP = 0.12; // normalized distance; a bigger jump than this = re-acquired pinch, start a new stroke
const ERASE_RADIUS = 0.045; // normalized

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

function strokePath(context: CanvasRenderingContext2D, stroke: Stroke, w: number, h: number) {
  const pts = stroke.points;
  if (pts.length === 0) return;
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = stroke.width;

  if (pts.length === 1) {
    const [x, y] = pts[0];
    context.beginPath();
    context.arc(x * w, y * h, Math.max(3, stroke.width / 2), 0, Math.PI * 2);
    context.fill();
    return;
  }

  // Quadratic-through-midpoints smoothing: turns a polyline of raw sample
  // points into a continuous curve, which is what makes strokes look drawn
  // rather than stitched together from straight segments.
  context.beginPath();
  context.moveTo(pts[0][0] * w, pts[0][1] * h);
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const mx = ((x0 + x1) / 2) * w;
    const my = ((y0 + y1) / 2) * h;
    context.quadraticCurveTo(x0 * w, y0 * h, mx, my);
  }
  const last = pts[pts.length - 1];
  context.lineTo(last[0] * w, last[1] * h);
  context.stroke();
}

export default function GestureCanvas({ onStatus, initialGalleryOpen }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<MediaStream | null>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const artRef = useRef<HTMLCanvasElement>(null);

  const workRef = useRef<GestureWork>(emptyWork);
  const redoRef = useRef<Stroke[]>([]);
  const lastCommandRef = useRef({ gesture: "", at: 0 });
  const wasPinchingRef = useRef(false);
  const dirtyRef = useRef(false);
  const autosaveTimerRef = useRef<number>();
  const saveRef = useRef<() => void>(() => undefined);

  const [cameraReady, setCameraReady] = useState(false);
  const [work, setWork] = useState<GestureWork>(emptyWork);
  const [canRedo, setCanRedo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "server" | "local-only" | "offline">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [brushWidth, setBrushWidth] = useState(7);
  const [eraserMode, setEraserMode] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(!!initialGalleryOpen);

  const { result, ready: trackerReady, loadError } = useHandLandmarker(videoRef, cameraReady);

  const redrawArt = useCallback((strokes: Stroke[]) => {
    const canvas = artRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of strokes) strokePath(context, stroke, canvas.width, canvas.height);
  }, []);

  const syncWork = useCallback(() => {
    setWork({ ...workRef.current, strokes: [...workRef.current.strokes] });
    setCanRedo(redoRef.current.length > 0);
  }, []);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    localWork.save(workRef.current);
    window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      if (dirtyRef.current) saveRef.current();
    }, 2500);
  }, []);

  const clearCanvas = useCallback(() => {
    redoRef.current = [];
    workRef.current = { ...workRef.current, strokes: [], lastGesture: "FIST" };
    redrawArt([]);
    syncWork();
    markDirty();
  }, [markDirty, redrawArt, syncWork]);

  const undo = useCallback(() => {
    if (workRef.current.strokes.length === 0) return;
    const removed = workRef.current.strokes[workRef.current.strokes.length - 1];
    redoRef.current = [...redoRef.current, removed];
    workRef.current = { ...workRef.current, strokes: workRef.current.strokes.slice(0, -1), lastGesture: "VICTORY" };
    redrawArt(workRef.current.strokes);
    syncWork();
    markDirty();
  }, [markDirty, redrawArt, syncWork]);

  const redo = useCallback(() => {
    if (redoRef.current.length === 0) return;
    const restored = redoRef.current[redoRef.current.length - 1];
    redoRef.current = redoRef.current.slice(0, -1);
    workRef.current = { ...workRef.current, strokes: [...workRef.current.strokes, restored] };
    redrawArt(workRef.current.strokes);
    syncWork();
    markDirty();
  }, [markDirty, redrawArt, syncWork]);

  const save = useCallback(async () => {
    setSaving(true);
    setError("");
    localWork.save(workRef.current);
    try {
      const saved = await gestureApi.saveWork(workRef.current);
      workRef.current = saved;
      dirtyRef.current = false;
      setSaveStatus("server");
      setLastSavedAt(Date.now());
      syncWork();
      onStatus?.("Workspace saved to your account");
    } catch (nextError) {
      // The drawing is never lost: it's already in localStorage above.
      dirtyRef.current = false;
      setSaveStatus("local-only");
      setLastSavedAt(Date.now());
      setError(nextError instanceof Error ? nextError.message : "Could not save to the server");
    } finally {
      setSaving(false);
    }
  }, [onStatus, syncWork]);

  useEffect(() => {
    saveRef.current = () => void save();
  }, [save]);

  const exportPng = useCallback(() => {
    const canvas = artRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "gesture-canvas-export.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  const getCurrentSnapshot = useCallback(() => {
    const canvas = artRef.current;
    if (!canvas) return null;
    // Downscale to a small thumbnail so the gallery list stays light to load.
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = 240;
    thumbCanvas.height = 135;
    const ctx = thumbCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#fcfbf8";
      ctx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
      ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
    }
    return { work: workRef.current, thumbnail: thumbCanvas.toDataURL("image/png", 0.8) };
  }, []);

  const openFromGallery = useCallback(
    (loaded: GestureWork) => {
      redoRef.current = [];
      workRef.current = loaded;
      redrawArt(loaded.strokes);
      syncWork();
      markDirty();
    },
    [markDirty, redrawArt, syncWork]
  );

  // Initial load: prefer the server copy, fall back to this device's local backup.
  useEffect(() => {
    let mounted = true;
    void gestureApi
      .getWork()
      .then((saved) => {
        if (!mounted) return;
        const local = localWork.load();
        const chosen = saved.strokes.length > 0 || !local ? saved : local;
        workRef.current = chosen;
        setSaveStatus("server");
        redrawArt(chosen.strokes);
        syncWork();
      })
      .catch(() => {
        if (!mounted) return;
        const local = localWork.load();
        if (local) {
          workRef.current = local;
          redrawArt(local.strokes);
          syncWork();
        }
        setSaveStatus("offline");
      });
    return () => {
      mounted = false;
      window.clearTimeout(autosaveTimerRef.current);
    };
  }, [redrawArt, syncWork]);

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

  useEffect(() => {
    if (loadError) setError(loadError);
  }, [loadError]);

  useEffect(() => {
    const overlay = overlayRef.current;
    const art = artRef.current;
    if (overlay) {
      overlay.width = CANVAS_W;
      overlay.height = CANVAS_H;
    }
    if (art) {
      art.width = CANVAS_W;
      art.height = CANVAS_H;
    }
  }, []);

  // Keyboard shortcuts: Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo, Ctrl/Cmd+S save.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      if (event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
      } else if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      } else if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [redo, save, undo]);

  // Main per-frame reaction to the hand tracker: skeleton overlay, discrete
  // command gestures (debounced so a held pose only fires once), and pinch
  // draw / erase.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const context = overlay.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, overlay.width, overlay.height);
    const points = result.landmarks;

    if (points.length === 21) {
      context.fillStyle = eraserMode ? "#d16b6b" : "#b7ded5";
      context.strokeStyle = eraserMode ? "rgba(209,107,107,0.72)" : "rgba(183, 222, 213, 0.72)";
      context.lineWidth = 2;

      HAND_CONNECTIONS.forEach(([a, b]) => {
        context.beginPath();
        context.moveTo((1 - points[a].x) * CANVAS_W, points[a].y * CANVAS_H);
        context.lineTo((1 - points[b].x) * CANVAS_W, points[b].y * CANVAS_H);
        context.stroke();
      });
      points.forEach((point) => {
        context.beginPath();
        context.arc((1 - point.x) * CANVAS_W, point.y * CANVAS_H, 4, 0, Math.PI * 2);
        context.fill();
      });

      const now = Date.now();
      const previousCommand = lastCommandRef.current;
      const isPinch = result.gesture === "PINCH" && result.confidence >= 0.62;

      // Discrete, debounced commands — anything that isn't the continuous pinch draw.
      if (!isPinch && result.confidence >= 0.62 && result.gesture !== "NO_HAND") {
        const steadyLongEnough = result.gesture === previousCommand.gesture && now - previousCommand.at > GESTURE_HOLD_MS;
        if (result.gesture !== previousCommand.gesture) {
          lastCommandRef.current = { gesture: result.gesture, at: now };
        } else if (steadyLongEnough && now - previousCommand.at < GESTURE_HOLD_MS + 250) {
          if (result.gesture === "FIST") clearCanvas();
          else if (result.gesture === "VICTORY") undo();
          else if (result.gesture === "THUMBS_UP") void save();
          else if (result.gesture === "OPEN_PALM") setEraserMode((prev) => !prev);
          lastCommandRef.current = { gesture: result.gesture, at: now + 100000 }; // fire once per hold
          workRef.current = { ...workRef.current, transcript: [...workRef.current.transcript, result.gesture].slice(-100) };
          syncWork();
        }
      } else if (!isPinch) {
        lastCommandRef.current = { gesture: "", at: 0 };
      }

      if (isPinch) {
        const tip = points[8];
        const point: [number, number] = [1 - tip.x, tip.y];

        if (eraserMode) {
          const before = workRef.current.strokes.length;
          const kept = workRef.current.strokes.filter(
            (stroke) => !stroke.points.some(([sx, sy]) => Math.hypot(sx - point[0], sy - point[1]) < ERASE_RADIUS)
          );
          if (kept.length !== before) {
            workRef.current = { ...workRef.current, strokes: kept, lastGesture: "PINCH" };
            redrawArt(kept);
            syncWork();
            markDirty();
          }
        } else {
          const strokes = workRef.current.strokes;
          const previous = strokes.at(-1);
          const previousPoint = previous?.points.at(-1);
          const jumped = previousPoint ? Math.hypot(previousPoint[0] - point[0], previousPoint[1] - point[1]) > PINCH_JUMP : true;

          if (wasPinchingRef.current && previous && previous.color === color && previous.width === brushWidth && !jumped) {
            previous.points.push(point);
          } else {
            redoRef.current = [];
            workRef.current = { ...workRef.current, strokes: [...strokes, { points: [point], color, width: brushWidth }] };
          }
          workRef.current.lastGesture = "PINCH";
          redrawArt(workRef.current.strokes);
        }
        wasPinchingRef.current = true;
      } else {
        if (wasPinchingRef.current) {
          syncWork();
          markDirty();
        }
        wasPinchingRef.current = false;
      }
    } else {
      wasPinchingRef.current = false;
    }
  }, [brushWidth, clearCanvas, color, eraserMode, markDirty, redrawArt, result, save, syncWork, undo]);

  const savedLabel = (() => {
    if (saving) return "Saving…";
    if (!lastSavedAt) return saveStatus === "offline" ? "Working offline — saved to this device only" : "Not saved yet";
    const secondsAgo = Math.max(0, Math.round((Date.now() - lastSavedAt) / 1000));
    const where = saveStatus === "server" ? "your account" : "this device only";
    if (secondsAgo < 5) return `Saved to ${where} just now`;
    if (secondsAgo < 60) return `Saved to ${where} ${secondsAgo}s ago`;
    return `Saved to ${where} ${Math.round(secondsAgo / 60)}m ago`;
  })();

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
        <div className={`gesture-status ${cameraReady && trackerReady ? "live" : ""}`}>
          <span /> {cameraReady && trackerReady ? `LIVE · ${result.fps || 0} FPS` : "STARTING CAMERA"}
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
            <small>Draw or erase with index finger</small>
          </span>
          <span>
            <b>2</b>
            <strong>Fist (hold)</strong>
            <small>Clear canvas</small>
          </span>
          <span>
            <b>3</b>
            <strong>Victory (hold)</strong>
            <small>Undo stroke</small>
          </span>
          <span>
            <b>4</b>
            <strong>Thumbs up (hold)</strong>
            <small>Save workspace</small>
          </span>
          <span>
            <b>5</b>
            <strong>Open palm (hold)</strong>
            <small>Toggle eraser</small>
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
              <span>DETECTED GESTURE {eraserMode ? "· ERASER ON" : ""}</span>
              <strong>{labels[result.gesture] ?? result.gesture}</strong>
            </div>
            <b>{Math.round(result.confidence * 100)}%</b>
          </div>

          <div className="gesture-toolbar">
            <div className="gesture-palette">
              {PALETTE.map((swatch) => (
                <button
                  key={swatch}
                  aria-label={`Use color ${swatch}`}
                  className={`gesture-swatch ${color === swatch && !eraserMode ? "active" : ""}`}
                  style={{ background: swatch }}
                  onClick={() => {
                    setColor(swatch);
                    setEraserMode(false);
                  }}
                />
              ))}
              <input
                type="color"
                aria-label="Custom color"
                value={color}
                onChange={(event) => {
                  setColor(event.target.value);
                  setEraserMode(false);
                }}
                className="gesture-color-input"
              />
            </div>
            <label className="gesture-brush">
              <span>Brush {brushWidth}px</span>
              <input
                type="range"
                min={2}
                max={24}
                value={brushWidth}
                onChange={(event) => setBrushWidth(Number(event.target.value))}
              />
            </label>
            <button
              className={`button button-ghost ${eraserMode ? "active" : ""}`}
              onClick={() => setEraserMode((prev) => !prev)}
              title="Toggle eraser (or hold an open palm)"
            >
              <Wand2 size={15} /> {eraserMode ? "Erasing" : "Eraser"}
            </button>
          </div>

          <div className="gesture-actions">
            <button className="button button-ghost" onClick={clearCanvas} title="Clear canvas">
              <Eraser size={15} /> Clear
            </button>
            <button className="button button-ghost" onClick={undo} disabled={work.strokes.length === 0} title="Undo (Ctrl+Z)">
              <RotateCcw size={15} /> Undo
            </button>
            <button className="button button-ghost" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
              <Redo2 size={15} /> Redo
            </button>
            <button className="button button-ghost" onClick={exportPng} title="Export as PNG">
              <Download size={15} /> PNG
            </button>
            <button className="button button-primary" onClick={() => void save()} disabled={saving} title="Save (Ctrl+S)">
              {saving ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
              {saving ? "Saving" : "Save"}
            </button>
            <button className="button button-ghost" onClick={() => setGalleryOpen(true)} title="My saved works">
              <FolderOpen size={15} /> My Saved Works
            </button>
          </div>
          <div className="gesture-save-status">{savedLabel}</div>
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

      <GestureGalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onOpenWork={openFromGallery}
        getCurrentSnapshot={getCurrentSnapshot}
      />
    </section>
  );
}
