import dotenv from "dotenv";
dotenv.config();

import { WebSocketServer } from "ws";
import { GameManagerService } from "./services/GameManagerService";
import { config } from "./config";
import { logger } from "./utils/logger";
import https from "https";
import http from "http";
import fs from "fs";

const isProduction = process.env.NODE_ENV === "production";

let server;

if (isProduction) {
  const privateKeyPath =
    "/etc/letsencrypt/live/api.chessify.adistrim.in/privkey.pem";
  const certificatePath =
    "/etc/letsencrypt/live/api.chessify.adistrim.in/fullchain.pem";

  try {
    const privateKey = fs.readFileSync(privateKeyPath);
    const certificate = fs.readFileSync(certificatePath);
    server = https.createServer({
      key: privateKey,
      cert: certificate,
    });
    logger.info("Using HTTPS server with Let's Encrypt certificates");
  } catch (error: any) {
    logger.error(`Failed to load SSL certificates: ${error.message}`);
    process.exit(1);
  }
} else {
  server = http.createServer();
  logger.info("Using HTTP server for development (ws://)");
}

const wss = new WebSocketServer({
  server,
});

const gameManager = new GameManagerService();

wss.on("connection", (socket) => {
  logger.info(
    `New WebSocket connection established (${isProduction ? "WSS" : "WS"})`,
  );
  gameManager.handleConnection(socket);
  socket.on("close", () => {
    logger.info("WebSocket connection closed");
    gameManager.handleDisconnect(socket);
  });
  socket.on("error", (error) => {
    logger.error("WebSocket error:", error);
  });
});

const handleShutdown = () => {
  logger.info("Server shutting down...");
  gameManager.shutdown();
  wss.close(() => {
    logger.info("WebSocket server closed");
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  });
};

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

const wssPort = config.server.port;
const wssHost = config.server.host || "0.0.0.0";

server.listen(wssPort, wssHost, () => {
  logger.info(
    `WebSocket server started on ${isProduction ? "wss" : "ws"}://${wssHost}:${wssPort}`,
  );
});
