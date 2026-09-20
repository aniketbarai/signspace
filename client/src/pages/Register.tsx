import { ArrowLeft, ArrowRight, Check, Info, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import FaceCamera, { type FaceCameraHandle } from "../components/FaceCamera";
import { authApi } from "../services/api";
import AuthLayout from "./AuthLayout";

type CameraState = "idle" | "requesting" | "ready" | "denied" | "unavailable";

export default function Register() {
  const [, navigate] = useLocation();
  const cameraRef = useRef<FaceCameraHandle>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ name: "", email: "" });
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleNextStep = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (form.name.trim().length < 2) return setError("Enter your full name to continue.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("Enter a valid email address.");
    setStep(2);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (cameraState !== "ready") return setError("Enable your camera and position your face inside the frame.");

    const images = await cameraRef.current?.captureMultiple(3);
    if (!images || images.length < 3) return setError("We could not capture three clear frames. Please try again.");

    setBusy(true);
    try {
      await authApi.register({ name: form.name.trim(), email: form.email.trim(), images });
      setDone(true);
      window.setTimeout(() => navigate("/login"), 1500);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="CREATE YOUR ACCOUNT"
      title={done ? "You’re all set." : "A face-first welcome."}
      description={
        done
          ? "Your private face template is registered. Taking you to face login…"
          : "Create your sign/space identity in a few simple moments. No password to remember."
      }
    >
      <div className="form-card">
        <div className="form-heading">
          <div>
            <span className="form-step">STEP {step} OF 2</span>
            <h2>{done ? "Face registered" : step === 1 ? "Enter details" : "Verify face"}</h2>
          </div>
          <span className="form-counter">0{step}</span>
        </div>

        {done ? (
          <div className="success-state">
            <div className="success-icon">
              <Check size={26} />
            </div>
            <h3>Identity captured.</h3>
            <p>Your account is ready. We’ll take you to login so you can test the full flow.</p>
          </div>
        ) : step === 1 ? (
          /* STEP 1: Basic Info */
          <form onSubmit={handleNextStep}>
            <label className="field-label">
              Full name
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="e.g. Aniket Sharma"
                autoComplete="name"
              />
            </label>
            <label className="field-label">
              Email address
              <input
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
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
              Continue to face setup <ArrowRight size={17} />
            </button>
          </form>
        ) : (
          /* STEP 2: Camera Verification (Always Active) */
          <form onSubmit={submit}>
            <label className="field-label">Face Scan</label>

            <FaceCamera ref={cameraRef} isScanning={busy} onStateChange={setCameraState} />

            {error && (
              <div className="form-error">
                <Info size={16} /> {error}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
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
                    <Loader2 size={17} className="spin" /> Capturing your face…
                  </>
                ) : (
                  <>
                    Register face <ArrowRight size={17} />
                  </>
                )}
              </button>
            </div>

            <p className="legal-note">
              By continuing, you acknowledge that a mathematical biometric representation will be used to authenticate
              your account. Raw face photos are not stored.
            </p>
          </form>
        )}

        <div className="form-footer">
          Already registered?{" "}
          <Link href="/login">
            Log in with face <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}