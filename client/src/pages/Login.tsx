import { ArrowLeft, ArrowRight, Check, Info, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import FaceCamera, { type FaceCameraHandle } from "../components/FaceCamera";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../services/api";
import AuthLayout from "./AuthLayout";

type CameraState = "idle" | "requesting" | "ready" | "denied" | "unavailable";

export default function Login() {
  const [, navigate] = useLocation();
  const { refresh } = useAuth();
  const cameraRef = useRef<FaceCameraHandle>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleNextStep = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError("Enter the email address associated with your account.");
    }
    setStep(2);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (cameraState !== "ready") {
      return setError("Enable your camera and position your face inside the frame.");
    }

    const image = cameraRef.current?.capture();
    if (!image) {
      return setError("We could not capture a clear frame. Please try again.");
    }

    setBusy(true);
    try {
      await authApi.login({ email: email.trim(), image });
      await refresh();
      setDone(true);
      window.setTimeout(() => navigate("/login-success"), 700);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Face verification failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="WELCOME BACK"
      title={done ? "Identity verified." : "Authentication required."}
      description={
        done
          ? "Identity verified. Redirecting to your workspace…"
          : "Sign in securely using your registered face biometric."
      }
    >
      <div className="form-card">
        <div className="form-heading">
          <div>
            <span className="form-step">STEP {step} OF 2</span>
            <h2>{done ? "Authentication successful" : step === 1 ? "Enter account email" : "Biometric verification"}</h2>
          </div>
          <span className="form-counter">0{step}</span>
        </div>

        {done ? (
          <div className="success-state">
            <div className="success-icon">
              <Check size={26} />
            </div>
            <h3>Welcome back.</h3>
            <p>Your biometric data matches the private template on your account.</p>
          </div>
        ) : step === 1 ? (
          /* STEP 1: Email Input */
          <form onSubmit={handleNextStep}>
            <label className="field-label">
              Email address
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
              />
            </label>

            {error && (
              <div className="form-error">
                <Info size={16} /> {error}
              </div>
            )}

            <button className="button button-primary button-full" type="submit">
              Continue to face verification <ArrowRight size={17} />
            </button>
          </form>
        ) : (
          /* STEP 2: Camera Verification (Always Active) */
          <form onSubmit={submit}>
            <label className="field-label">Face Verification</label>

            <FaceCamera ref={cameraRef} isScanning={busy} onStateChange={setCameraState} />

            {error && (
              <div className="form-error">
                <Info size={16} /> {error}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setError("");
                  setStep(1);
                }}
                disabled={busy}
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button className="button button-primary button-full" type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 size={17} className="spin" /> Verifying identity…
                  </>
                ) : (
                  <>
                    Login with face <ArrowRight size={17} />
                  </>
                )}
              </button>
            </div>

            <div className="verification-note">
              <Check size={14} /> The detected face must match your registered account template.
            </div>
          </form>
        )}

        <div className="form-footer">
          New user?{" "}
          <Link href="/register">
            Register with face <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}