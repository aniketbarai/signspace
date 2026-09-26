const parsedThreshold = Number(process.env.FACE_MATCH_THRESHOLD ?? "0.82");

export const config = {
  port: Number(process.env.PORT ?? "3000"),
  mongoUri: process.env.MONGO_URI ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "development-secret-change-me",
  biometricVaultSecret: process.env.BIOMETRIC_VAULT_SECRET ?? process.env.JWT_SECRET ?? "development-biometric-secret-change-me",
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
}
