import { Queue } from "bullmq";
import { createRedisConnection } from "./redisConnection.js";

export const pdfQueue = new Queue("pdf-queue", {
  connection: createRedisConnection(),
});
