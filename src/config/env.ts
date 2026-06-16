export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "3002", 10),
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwt: {
    secret: process.env.JWT_SECRET ?? "dev-secret",
    expiresIn: process.env.JWT_EXPIRES_IN ?? "1h",
  },
  cors: {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:8081",
    webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3001",
    mobileOrigin: process.env.MOBILE_ORIGIN ?? "http://localhost:8081",
    allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? "https://frontend-staging-24fc.up.railway.app")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  },
} as const;
