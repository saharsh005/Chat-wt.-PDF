import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

function parseBoolean(value) {
  return ["1", "true", "yes"].includes(String(value || "").toLowerCase());
}

function parseRedisUrl(value) {
  const redisUrl = new URL(value);
  const usesTls =
    redisUrl.protocol === "rediss:" || parseBoolean(process.env.REDIS_TLS);

  return {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port || "6379", 10),
    username: decodeURIComponent(redisUrl.username || "default"),
    password: decodeURIComponent(redisUrl.password || process.env.REDIS_PASSWORD || ""),
    ...(usesTls ? { tls: {} } : {}),
  };
}

export function createRedisConnection() {
  const common = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  if (process.env.REDIS_URL) {
    return {
      ...parseRedisUrl(process.env.REDIS_URL),
      ...common,
    };
  }

  if (process.env.REDIS_HOST?.startsWith("redis://") || process.env.REDIS_HOST?.startsWith("rediss://")) {
    return {
      ...parseRedisUrl(process.env.REDIS_HOST),
      ...common,
    };
  }

  const usesTls = parseBoolean(process.env.REDIS_TLS);

  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    username: process.env.REDIS_USERNAME || "default",
    password: process.env.REDIS_PASSWORD,
    ...(usesTls ? { tls: {} } : {}),
    ...common,
  };
}
