import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().default("Mira Health Intelligence"),
  NEXT_PUBLIC_APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  AI_PROVIDER: z.enum(["mock", "internal", "openai", "groq"]).default("internal"),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  SESSION_SECRET: z.string().min(16).default("dev-only-insecure-secret-replace-in-production"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
