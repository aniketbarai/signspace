import {
  ArrowUpRight,
  Check,
  Fingerprint,
  FolderOpen,
  Hand,
  LogOut,
  LockKeyhole,
  ScanFace,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Brand } from "../components/AppShell";
import EmotionScan from "../components/EmotionScan";
import GestureCanvas from "../components/GestureCanvas";
import { useAuth } from "../context/AuthContext";

type Action = "canvas" | "gallery" | null;
type Tab = "canvas" | "emotion";

const OPTIONS: {
  id: Exclude<Action, null>;
  icon: typeof Hand;
  title: string;
  description: string;
}[] = [
  {
    id: "canvas",
    icon: Hand,
    title: "Hand Gesture Canvas",
    description: "Turn on the camera and draw, undo, and save using hand gestures alone.",
  },
  {
    id: "gallery",
    icon: FolderOpen,
    title: "My Saved Works",
    description: "Browse, reopen, or delete the drawings you've saved to your account.",
  },
];

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState("");
  const [action, setAction] = useState<Action>(null);
  const [tab, setTab] = useState<Tab>("canvas");

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  if (loading || !user) return <div className="dashboard-loading"><div className="loader-orb"><ScanFace size={28} /></div><p>Checking your secure session…</p></div>;

  const firstName = user.name.split(" ")[0];
  return <div className="dashboard-page"><header className="dashboard-header"><Brand /><div className="dashboard-header-right"><div className="session-chip"><span className="session-dot" /> Authenticated</div><button className="logout-button" onClick={async () => { await logout(); navigate("/"); }}><LogOut size={15} /> Log out</button></div></header>
    <main className="dashboard-main">
      <div className="dashboard-intro"><div><div className="eyebrow"><span className="eyebrow-pulse" /> YOUR PRIVATE WORKSPACE</div><h1>Welcome, {firstName} <span>↗</span></h1><p>Face authentication successful. Your hand-language workspace is ready.</p></div></div>
      <div className="assistant-preview">
        <div className="assistant-heading">
          <div><h2>What would you like to do?</h2></div>
          {action && (
            <button className="button button-ghost" onClick={() => setAction(null)}>
              <ArrowUpRight size={14} style={{ transform: "rotate(225deg)" }} /> Back to options
            </button>
          )}
        </div>
        {!action && (
          <div className="assistant-grid">
            {OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  className="assistant-tile"
                  style={{ textAlign: "left", cursor: "pointer", border: "1px solid var(--line)", width: "100%" }}
                  onClick={() => {
                    setAction(option.id);
                    setTab("canvas");
                  }}
                >
                  <div className="tile-icon"><Icon size={17} /></div>
                  <div>
                    <h3>{option.title}</h3>
                    <p>{option.description}</p>
                  </div>
                  <ArrowUpRight size={16} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {action && (
        <>
          <div className="workspace-tabs">
            <button className={`workspace-tab ${tab === "canvas" ? "active" : ""}`} onClick={() => setTab("canvas")}>
              <Hand size={15} /> Hand Canvas
            </button>
            <button className={`workspace-tab ${tab === "emotion" ? "active" : ""}`} onClick={() => setTab("emotion")}>
              <ScanFace size={15} /> Emotion Scan
            </button>
          </div>
          {tab === "canvas" ? (
            <GestureCanvas onStatus={setStatus} initialGalleryOpen={action === "gallery"} />
          ) : (
            <EmotionScan />
          )}
        </>
      )}

      {status && <div className="dashboard-note"><Sparkles size={16} /><span>{status} <Link href="/dashboard">Keep exploring <ArrowUpRight size={13} /></Link></span></div>}
      <div className="dashboard-note"><Fingerprint size={16} /><span>Authenticated without a password. <Link href="/">Return to sign/space <ArrowUpRight size={13} /></Link></span></div>
    </main>
  </div>;
}
