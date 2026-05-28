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

  // Only connect to Discord in production — the deployed app is the single
  // authoritative bot instance. Running the bot in dev at the same time as
  // the deployed version causes two clients with the same token to both
  // respond to every message (double embeds).
  if (process.env["NODE_ENV"] !== "development") {
    startBot().catch((e) => logger.error({ e }, "Failed to start Discord bot"));
  } else {
    logger.info("Development mode — Discord bot disabled to prevent double responses with the deployed instance");
  }
});

const shutdown = (signal: string) => {
  logger.info({ signal }, "Graceful shutdown started");
  server.close(() => {
    logger.info("HTTP server closed — exiting");
    process.exit(0);
  });
  setTimeout(() => {
    logger.info("Forced exit after timeout");
    process.exit(0);
  }, 5000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
