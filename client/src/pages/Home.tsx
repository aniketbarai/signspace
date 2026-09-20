import { ArrowRight, Camera, Check, Fingerprint, LockKeyhole, ScanFace, Sparkles } from "lucide-react";
import { Link } from "wouter";
import AppShell from "../components/AppShell";

const steps = [
  { number: "01", icon: Camera, title: "Open your camera", text: "Give your browser permission when you are ready. Nothing starts in the background." },
  { number: "02", icon: ScanFace, title: "Find your face", text: "The AI service checks that exactly one face is visible and positioned clearly." },
  { number: "03", icon: Fingerprint, title: "Enter with a look", text: "A private face embedding verifies your identity without a traditional password." },
];

export default function Home() {
  return (
    <AppShell>
      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-pulse" /> PHASE 01 · FACE AUTHENTICATION</div>
            <h1>Access that feels <em>human.</em></h1>
            <p className="hero-lede">A more natural first step toward communication without barriers. Sign in with your face, then get ready for what comes next.</p>
            <div className="hero-actions"><Link href="/register" className="button button-primary">Register with face <ArrowRight size={17} /></Link><Link href="/login" className="button button-ghost">Login with face <span className="button-key">↗</span></Link></div>
            <div className="hero-trust"><div className="avatar-stack"><span>A</span><span>R</span><span>M</span><span className="avatar-more">+</span></div><span>Built for a quieter, more inclusive web</span></div>
          </div>
          <div className="hero-visual">
            <div className="visual-glow" />
            <div className="visual-card">
              <div className="visual-topline"><span className="visual-status"><i /> SYSTEM READY</span><span>01 / 03</span></div>
              <div className="visual-face"><div className="visual-face-ring"><div className="visual-scanline" /><Fingerprint size={72} strokeWidth={1.2} /></div><div className="visual-corner corner-tl" /><div className="visual-corner corner-tr" /><div className="visual-corner corner-bl" /><div className="visual-corner corner-br" /></div>
              <div className="visual-caption"><div><span className="caption-label">IDENTITY SIGNAL</span><strong>Ready to recognize</strong></div><span className="caption-check"><Check size={17} /></span></div>
            </div>
            <div className="floating-note note-top"><LockKeyhole size={15} /><span><b>Private by design</b><small>No photos stored</small></span></div>
            <div className="floating-note note-bottom"><Sparkles size={15} /><span><b>Built for Phase 2</b><small>Sign language, next</small></span></div>
          </div>
        </section>

        <section className="principles-section" id="privacy"><div className="section-kicker">WHY SIGN/SPACE</div><div className="principles-grid"><div><h2>Your face is the key.<br /><span>Your data stays yours.</span></h2></div><div className="principle-copy"><p>Sign/space stores a mathematical face representation for authentication — not the raw camera photograph. The architecture is ready for a future where face authentication leads into sign language recognition, text, and speech.</p><div className="privacy-pill"><LockKeyhole size={15} /> Biometric representation · never exposed to the browser</div></div></div></section>

        <section className="steps-section" id="how-it-works"><div className="steps-heading"><div><div className="section-kicker">HOW IT WORKS</div><h2>Three quiet steps<br /><span>to get started.</span></h2></div><p>Designed to be clear, quick, and respectful of your attention.</p></div><div className="steps-grid">{steps.map(({ number, icon: Icon, title, text }) => <article className="step-card" key={number}><div className="step-top"><span>{number}</span><Icon size={21} /></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>

        <section className="phase-banner"><div><div className="section-kicker">THE ROAD AHEAD</div><h2>Face authentication is<br /><em>just the beginning.</em></h2></div><div className="phase-banner-right"><p>Phase 1 is live now. Sign language recognition arrives in Phase 2 — without rebuilding the foundation.</p><div className="phase-progress"><span className="phase-active" /><span /><span /><span /></div><small>01 · AUTHENTICATE &nbsp; 02 · RECOGNIZE &nbsp; 03 · TRANSLATE &nbsp; 04 · SPEAK</small></div></section>
      </main>
    </AppShell>
  );
}
