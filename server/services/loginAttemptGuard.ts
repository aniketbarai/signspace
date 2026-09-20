const WINDOW_MS = 10 * 60 * 1000;
const LOCK_MS = 5 * 60 * 1000;
const MAX_FAILURES = 5;

type AttemptState = {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
};

const attempts = new Map<string, AttemptState>();

function keyFor(email: string, ip?: string) {
  return `${email}:${ip || "unknown"}`;
}

export function assertLoginAllowed(email: string, ip?: string) {
  const key = keyFor(email, ip);
  const state = attempts.get(key);
  const now = Date.now();
  if (!state) return;
  if (state.lockedUntil > now) {
    const seconds = Math.ceil((state.lockedUntil - now) / 1000);
    throw new Error(`Too many failed face attempts. Try again in ${seconds} seconds.`);
  }
  if (now - state.firstFailureAt > WINDOW_MS) {
    attempts.delete(key);
  }
}

export function recordLoginFailure(email: string, ip?: string) {
  const key = keyFor(email, ip);
  const now = Date.now();
  const previous = attempts.get(key);
  const state = !previous || now - previous.firstFailureAt > WINDOW_MS
    ? { failures: 0, firstFailureAt: now, lockedUntil: 0 }
    : previous;

  state.failures += 1;
  if (state.failures >= MAX_FAILURES) {
    state.lockedUntil = now + LOCK_MS;
  }
  attempts.set(key, state);
}

export function clearLoginFailures(email: string, ip?: string) {
  attempts.delete(keyFor(email, ip));
}
