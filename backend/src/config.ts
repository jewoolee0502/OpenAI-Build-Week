import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:8080"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgres://imaginelab:imaginelab_local@localhost:5432/imaginelab"),
  AUTO_MIGRATE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.6"),
  OPENAI_IMAGE_MODEL: z.string().default("gpt-image-2"),
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
  databaseUrl: string;
  autoMigrate: boolean;
  openAiApiKey?: string;
  openAiModel: string;
  openAiImageModel: string;
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
    databaseUrl: env.DATABASE_URL,
    autoMigrate: env.AUTO_MIGRATE,
    openAiModel: env.OPENAI_MODEL,
    openAiImageModel: env.OPENAI_IMAGE_MODEL,
    openAiTranscriptionModel: env.OPENAI_TRANSCRIPTION_MODEL,
    allowedOrigins: env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()),
    ...(env.OPENAI_API_KEY ? { openAiApiKey: env.OPENAI_API_KEY } : {}),
  };

  return { ...base, ...overrides };
}
