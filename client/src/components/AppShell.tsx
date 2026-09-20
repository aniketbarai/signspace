import { ArrowUpRight, Fingerprint, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";

export function Brand() {
  return <Link href="/" className="brand"><span className="brand-mark"><Fingerprint size={17} /></span><span>sign<span className="brand-accent">/</span>space</span></Link>;
}

export default function AppShell({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <div className="app-shell">
      <header className={`site-header ${compact ? "compact" : ""}`}>
        <Brand />
        {!compact && <nav className="site-nav"><a href="#how-it-works">How it works</a><a href="#privacy">Privacy first</a><Link href="/login" className="nav-cta">Sign in <ArrowUpRight size={14} /></Link></nav>}
        {compact && <div className="secure-chip"><ShieldCheck size={14} /> Biometric privacy by design</div>}
      </header>
      {children}
      <footer className="site-footer"><span>© 2026 sign/space</span><span className="footer-dot" /><span>Phase 1 · Face authentication</span></footer>
    </div>
  );
}
