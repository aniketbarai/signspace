import { Fingerprint, LockKeyhole, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import AppShell from "../components/AppShell";

export default function AuthLayout({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <AppShell compact>
      <main className="auth-page">
        <section className="auth-context">
          <div className="eyebrow"><Sparkles size={14} /> {eyebrow}</div>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="auth-proof-list">
            <div><span className="proof-icon"><Fingerprint size={17} /></span><span><strong>Face, not passwords</strong><small>Your face becomes a private mathematical template.</small></span></div>
            <div><span className="proof-icon"><LockKeyhole size={17} /></span><span><strong>Privacy by design</strong><small>We process one still frame. No camera stream is uploaded.</small></span></div>
          </div>
        </section>
        <section className="auth-card-wrap">{children}</section>
      </main>
    </AppShell>
  );
}
