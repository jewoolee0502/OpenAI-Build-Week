import { resolve } from "node:path";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:8080"),
  DATA_FILE: z.string().default(".data/imaginelab.json"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.6"),
  OPENAI_TRANSCRIPTION_MODEL: z.string().default("gpt-4o-mini-transcribe"),
  ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:5173,http://localhost:8080"),
});

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  publicBaseUrl: string;
  dataFile: string;
  openAiApiKey?: string;
  openAiModel: string;
  openAiTranscriptionModel: string;
  allowedOrigins: string[];
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const env = envSchema.parse(process.env);
  const base: AppConfig = {
    nodeEnv: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    publicBaseUrl: env.PUBLIC_BASE_URL.replace(/\/$/, ""),
    dataFile: resolve(process.cwd(), env.DATA_FILE),
    openAiModel: env.OPENAI_MODEL,
    openAiTranscriptionModel: env.OPENAI_TRANSCRIPTION_MODEL,
    allowedOrigins: env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()),
    ...(env.OPENAI_API_KEY ? { openAiApiKey: env.OPENAI_API_KEY } : {}),
  };

  return { ...base, ...overrides };
}
