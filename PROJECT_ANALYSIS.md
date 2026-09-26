# sign/space Project Analysis

**Analyzed archive:** `signspace-main(2).zip`  
**Scope:** architecture, runtime wiring, security, build/test health, and maintainability  
**Assessment:** promising prototype; not production-ready for biometric authentication

## Executive summary

This is a React/Vite + Express/TypeScript application backed by MongoDB/Mongoose and a separate FastAPI/Python computer-vision service. The user flow is face-based registration/login, followed by an authenticated gesture canvas and emotion-scan UI.

The repository is structurally coherent and the production bundle builds, but the codebase is in a partially migrated state. The README describes a more complete/secure design than the active implementation: it says biometric data is private/encrypted and login attempts are protected, while the current auth path stores plaintext embeddings and does not call the login-attempt guard. TypeScript compilation currently fails in four locations.

**Recommendation:** treat this as a working prototype/demo. Before deployment, fix the compile errors, complete the biometric storage migration, harden authentication and privacy behavior, and add end-to-end tests against the actual MongoDB/Python services.

## What the system contains

- **Frontend:** React 19, Vite, Wouter, Tailwind/Radix UI, camera capture, gesture canvas, gallery, emotion scan.
- **Node API:** Express routes for auth, user session, gesture recognition, gesture work, and gallery; tRPC scaffold remains present but is not the main product API.
- **Database:** MongoDB via Mongoose for users, gesture work, and gallery items. The Drizzle/MySQL schema is scaffold residue and is not used by the active auth implementation.
- **AI service:** FastAPI with DeepFace/Facenet512 for face embeddings and MediaPipe 0.10.21 for heuristic hand-gesture classification.
- **Session:** HTTP-only JWT cookie, `SameSite=Lax`, rolling 400-day renewal.

## Request flows

### Registration

1. Browser requests camera access and captures three JPEG data URLs.
2. Node validates name/email and image count/size.
3. Node calls Python three times to create embeddings.
4. Node averages and normalizes the vectors.
5. Mongoose stores the embedding with the user record.

### Login

1. Browser sends email plus one captured JPEG.
2. Node looks up the account by email.
3. Python creates a candidate embedding.
4. Node compares cosine similarity with `FACE_MATCH_THRESHOLD` (default `0.82`).
5. A successful match issues the JWT cookie.

### Authenticated workspace

The cookie protects `/api/user/me` and all gesture routes. The dashboard supports server-side hand recognition, gesture-controlled drawing, autosave, transcript persistence, and a per-user gallery.

## Verification performed

| Check | Result |
|---|---|
| Dependency install | Completed with `pnpm install --frozen-lockfile` |
| `pnpm run check` | **Failed: 4 TypeScript errors** |
| `pnpm test` | **Passed: 3 files, 6 tests** |
| `pnpm run build` | **Passed**, with a >500 kB frontend chunk warning |
| Python service execution | Not run; DeepFace/TensorFlow dependencies are heavyweight and no image/database integration fixture is included |

## Findings by priority

### P0 — Biometric encryption exists but is not used

`server/services/biometricVault.ts` implements AES-256-GCM, but it is not referenced by the active user model or auth controller. `User.faceEmbedding` remains a plaintext numeric array, and registration writes it directly while login reads it directly.

This contradicts the README/security claims and means a database read or backup exposes reusable biometric templates. Face embeddings are not raw photographs, but they are still sensitive biometric identifiers and generally cannot be rotated like passwords.

**Fix:** choose one canonical representation and migrate it end-to-end: add an encrypted string field (preferably versioned ciphertext with key ID), encrypt before persistence, decrypt only for comparison, migrate existing records explicitly, and remove the legacy plaintext field after verification. Do not silently compare old and new embedding formats.

### P0 — The login-attempt lockout helper is dead code

`server/services/loginAttemptGuard.ts` defines five-failure/ten-minute tracking and a five-minute lock, but there are no runtime references to `assertLoginAllowed`, `recordLoginFailure`, or `clearLoginFailures`.

The only active control is the global Express limiter: 20 auth requests per 15 minutes per process. That is weaker than the documented per-account protection and is easy to evade with distributed IPs.

**Fix:** call the guard before face verification; record failures for unknown email, invalid face, and mismatches without creating a distinct account-enumeration signal; clear failures only after successful login. Use a shared store such as Redis in multi-instance deployments and add bounded cleanup/TTL behavior.

### P0 — Production validation is defined but never called

`assertProductionConfig()` checks only the default JWT secret, but `server/_core/index.ts` never invokes it. The app can therefore start with the development fallback secret unless another deployment layer prevents it.

**Fix:** call validation before binding the server. Require a strong JWT secret, biometric vault secret, Mongo URI, Python service URL, and an explicitly bounded face threshold in production. Fail closed.

### P1 — Login leaks account existence

`POST /api/auth/login` returns `404 "No account found for this email"`, while a known account with a wrong face returns `401`. This enables email/account enumeration.

**Fix:** return the same generic response and comparable timing for unknown email and failed face verification. Keep detailed diagnostics in protected server logs only.

### P1 — Biometric authentication has no liveness/anti-spoofing

A single still image is enough to authenticate. The Python README and root README acknowledge this limitation. A printed photo or screen replay is therefore in scope for an attacker.

**Fix:** add a documented liveness challenge (blink/head movement/depth or a model with anti-spoofing), bind the challenge to the login attempt, rate-limit it, and evaluate false-accept/false-reject rates on representative data before production use.

### P1 — Similarity threshold is not safely validated

`FACE_MATCH_THRESHOLD` is parsed as any finite number. Values outside the meaningful cosine range can make authentication always fail or become dangerously permissive.

**Fix:** reject values outside a deliberately chosen range at startup, and calibrate the threshold with real validation data for the exact DeepFace model/detector combination.

### P1 — TypeScript build gate is broken

`pnpm run check` reports:

- `EmotionScan.tsx`: nullable video ref is passed to a hook requiring `RefObject<HTMLVideoElement>`.
- `GestureCanvas.tsx`: `useRef<number>()` is invalid under the installed React 19 types; initialize it explicitly.
- `GestureCanvas.tsx`: same nullable video-ref mismatch.
- `server/services/biometricVault.ts`: `config.biometricVaultSecret` is missing from `server/config/env.ts`.

`pnpm run build` still succeeds because Vite/esbuild transpile without typechecking. CI should run `pnpm run check` and fail on these errors.

### P1 — The README and implementation have drifted

The README still contains earlier architecture statements (including Drizzle/MySQL and an older folder layout), while the actual implementation uses Mongoose/MongoDB and additional gesture/gallery/emotion functionality. It also claims encryption and security behavior that are not wired.

**Fix:** rewrite the README from the current runtime paths, document active environment variables and data fields, and add a release checklist that verifies claims against code.

### P2 — Session lifetime is unusually long and rolling

The JWT expires after 400 days and every authenticated request reissues it, so active use creates an effectively indefinite session. This is convenient but increases exposure if a cookie is stolen.

**Fix:** use a shorter access-session lifetime with rotation/revocation, or at minimum document the threat model and add session/device management and server-side revocation for a biometric account.

### P2 — Coverage is too narrow for the risk profile

The six passing tests cover cosine similarity, logout cookie clearing, and missing Mongo configuration. There are no tests for registration/login controllers, encrypted template handling, cookie flags, lockout behavior, threshold validation, route authorization, gallery ownership, or AI-service error mapping.

**Fix:** add unit and integration tests for those paths, including malformed/oversized images, no/multiple faces, dimension mismatch, unknown email, wrong face, duplicate registration, expired/tampered JWT, and cross-user gallery access.

### P2 — Python service operational concerns

DeepFace/TensorFlow model initialization and inference are heavyweight. The service uses synchronous handlers and may block the FastAPI worker under concurrent requests. The OpenCV Haar fallback is useful for availability but may alter face crops and matching behavior relative to DeepFace detection.

**Fix:** benchmark cold/warm latency, run an appropriate worker/process model, enforce request concurrency and timeouts, expose readiness separately from shallow `/health`, pin/check model weights, and evaluate the fallback as a separate detector configuration.

### P2 — Frontend performance warning

The production JS bundle is approximately 556 kB minified before gzip. Build output recommends code splitting. The component showcase and broad UI dependency surface are likely contributing.

**Fix:** lazy-load the dashboard/emotion/gesture surfaces and remove unused scaffold components/dependencies from the production path.

## Positive aspects

- Raw camera frames are not intentionally persisted by the application.
- Image payload size is bounded in both Node and Python paths.
- The Python service rejects invalid images and ambiguous multi-face inputs.
- User-facing errors avoid returning stack traces.
- User-facing API responses omit the embedding field.
- Protected gesture routes are consistently mounted behind `requireAuth`.
- Gallery queries include the authenticated `userId` boundary.
- Camera tracks are stopped on component unmount.
- The production bundle and current tests provide a usable baseline for continued work.

## Suggested implementation order

1. Fix the four TypeScript errors and make `pnpm run check` mandatory in CI.
2. Add strict startup configuration validation, including vault secret and threshold bounds.
3. Complete encrypted biometric storage migration with versioning and re-enrollment handling.
4. Wire login-attempt throttling and remove account enumeration responses.
5. Add liveness/anti-spoofing and calibrate the exact model/threshold.
6. Add auth/gesture/gallery integration tests and a Python-service health/readiness test.
7. Update the README to match the actual Mongoose + gesture-enabled implementation.
8. Optimize the frontend bundle and benchmark Python inference under load.

## Bottom line

The project is a credible prototype with a clear separation between web authentication and AI inference, and it builds successfully. It should not yet be presented as a secure biometric authentication system: the most important protection claimed in the documentation—encrypted biometric persistence—is currently unused, and the active TypeScript gate is failing. Address the P0/P1 items before handling real users or production biometric data.
