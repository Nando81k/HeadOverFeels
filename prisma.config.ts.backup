import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load environment variables from .env.local if it exists (local dev only)
// In production (Vercel), environment variables are already set
if (process.env.NODE_ENV !== 'production') {
  config({ path: ".env.local" });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
