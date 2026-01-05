import { Queue } from "bullmq";

export const pdfQueue = new Queue("pdf-queue", {
  connection: {
    host: "localhost",
    port: 6379,
    maxRetriesPerRequest: null
  }
});
