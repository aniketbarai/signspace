import { ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "./AuthLayout";

export default function LoginSuccess() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login");
      return;
    }

    const timer = window.setTimeout(() => navigate("/dashboard"), 1800);
    return () => window.clearTimeout(timer);
  }, [loading, user, navigate]);

  return <AuthLayout eyebrow="LOGIN SUCCESSFUL" title="Identity verified." description="Your face matched your private template. Opening your dashboard now.">
    <div className="form-card">
      <div className="form-heading"><div><span className="form-step">SECURE ACCESS</span><h2>Login successful</h2></div><span className="form-counter">03</span></div>
      <div className="success-state">
        <div className="success-icon"><ShieldCheck size={26} /></div>
        <h3>{user ? `Welcome, ${user.name.split(" ")[0]}.` : "Checking session..."}</h3>
        <p>{user ? "Your secure session is active. We are taking you to your dashboard." : "Confirming your session before opening the dashboard."}</p>
        <div className="verification-note">{loading ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Redirecting to dashboard</div>
      </div>
      <div className="form-footer">Ready now? <Link href="/dashboard">Open dashboard <ArrowRight size={14} /></Link></div>
    </div>
  </AuthLayout>;
}
