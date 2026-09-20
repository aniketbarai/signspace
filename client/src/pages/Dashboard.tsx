import { ArrowUpRight, Check, ChevronRight, Fingerprint, Hand, LogOut, Mic2, ScanFace, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Brand } from "../components/AppShell";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  if (loading || !user) return <div className="dashboard-loading"><div className="loader-orb"><ScanFace size={28} /></div><p>Checking your secure session…</p></div>;

  const firstName = user.name.split(" ")[0];
  return <div className="dashboard-page"><header className="dashboard-header"><Brand /><div className="dashboard-header-right"><div className="session-chip"><span className="session-dot" /> Authenticated</div><button className="logout-button" onClick={async () => { await logout(); navigate("/"); }}><LogOut size={15} /> Log out</button></div></header>
    <main className="dashboard-main">
      <div className="dashboard-intro"><div><div className="eyebrow"><span className="eyebrow-pulse" /> YOUR PRIVATE WORKSPACE</div><h1>Welcome, {firstName} <span>↗</span></h1><p>Face authentication successful. Your space is ready for what comes next.</p></div><div className="date-chip"><span className="date-dot" /> Session active</div></div>
      <section className="verified-card"><div className="verified-card-copy"><div className="verified-icon"><ShieldCheck size={24} /></div><span className="section-kicker">IDENTITY VERIFIED</span><h2>You’re in good company.</h2><p>Your face matched the encrypted mathematical template associated with <strong>{user.email}</strong>.</p><div className="verified-meta"><span><Check size={14} /> Match confirmed</span><span><LockKeyholeIcon /> Template protected</span></div></div><div className="verified-visual"><div className="verified-ring"><Fingerprint size={54} /></div><div className="ring-label ring-label-left">01 <span>AUTH</span></div><div className="ring-label ring-label-right">LIVE <span>SESSION</span></div></div></section>
      <section className="assistant-preview"><div className="assistant-heading"><div><div className="section-kicker">YOUR SIGN LANGUAGE ASSISTANT</div><h2>Communication, <em>next.</em></h2></div><span className="coming-badge"><Sparkles size={13} /> COMING IN PHASE 2</span></div><div className="assistant-grid"><div className="assistant-tile"><div className="tile-icon"><Hand size={19} /></div><div><h3>Real-time signing</h3><p>Hand and gesture recognition will arrive in the next phase.</p></div><ChevronRight size={17} /></div><div className="assistant-tile"><div className="tile-icon"><Mic2 size={19} /></div><div><h3>Text to speech</h3><p>Turn signed communication into a voice that can be heard.</p></div><ChevronRight size={17} /></div><div className="assistant-tile"><div className="tile-icon"><ArrowUpRight size={19} /></div><div><h3>A foundation that grows</h3><p>Authentication stays the same as the assistant evolves.</p></div><ChevronRight size={17} /></div></div></section>
      <div className="dashboard-note"><Fingerprint size={16} /><span>Authenticated without a password. <Link href="/">Return to sign/space <ArrowUpRight size={13} /></Link></span></div>
    </main>
  </div>;
}

function LockKeyholeIcon() { return <span className="tiny-lock">●</span>; }
