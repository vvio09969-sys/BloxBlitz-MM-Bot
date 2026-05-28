import app from "./app";
import { logger } from "./lib/logger";
import { startBot } from "./bot";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  startBot().catch((e) => logger.error({ e }, "Failed to start Discord bot"));
});

const shutdown = (signal: string) => {
  logger.info({ signal }, "Graceful shutdown started");
  server.close(() => {
    logger.info("HTTP server closed — exiting");
    process.exit(0);
  });
  // Force-exit after 5 s if connections won't drain
  setTimeout(() => {
    logger.info("Forced exit after timeout");
    process.exit(0);
  }, 5000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
