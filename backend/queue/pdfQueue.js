import { Queue } from "bullmq";

const REDIS_CONNECTION = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null,
};

export const pdfQueue = new Queue("pdf-queue", {
  connection: REDIS_CONNECTION,
});
