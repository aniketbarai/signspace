const parsedThreshold = Number(process.env.FACE_MATCH_THRESHOLD ?? "0.82");

export const config = {
  port: Number(process.env.PORT ?? "3000"),
  mongoUri: process.env.MONGO_URI ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "development-secret-change-me",
  // Dedicated key for encrypting biometric templates at rest. Falls back to
  // jwtSecret so local dev keeps working, but a compromised JWT secret should
  // not also unlock stored face templates in production.
  biometricVaultSecret: process.env.BIOMETRIC_VAULT_SECRET ?? process.env.JWT_SECRET ?? "development-secret-change-me",
  pythonAiUrl: process.env.PYTHON_AI_URL ?? "http://localhost:8000",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  faceMatchThreshold: Number.isFinite(parsedThreshold) ? parsedThreshold : 0.82,
  nodeEnv: process.env.NODE_ENV ?? "development",
  authCookieName: "face_auth_token",
};

export function assertProductionConfig() {
  if (config.nodeEnv === "production" && config.jwtSecret === "development-secret-change-me") {
    throw new Error("JWT_SECRET must be configured in production");
  }
  if (config.nodeEnv === "production" && config.biometricVaultSecret === config.jwtSecret) {
    console.warn(
      "[Config] BIOMETRIC_VAULT_SECRET is not set; reusing JWT_SECRET to encrypt biometric templates. Set a separate secret in production."
    );
  }
}