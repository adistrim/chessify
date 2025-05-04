import { WebSocketServer } from "ws";
import { GameManagerService } from "./services/GameManagerService";
import { config } from "./config";
import { logger } from "./utils/logger";
import https from "https";
import fs from "fs";

const privateKeyPath =
  "/etc/letsencrypt/live/api.chessify.adistrim.in/privkey.pem";
const certificatePath =
  "/etc/letsencrypt/live/api.chessify.adistrim.in/fullchain.pem";

const privateKey = fs.readFileSync(privateKeyPath);
const certificate = fs.readFileSync(certificatePath);

const httpsServer = https.createServer({
  key: privateKey,
  cert: certificate,
});

const wss = new WebSocketServer({
  server: httpsServer,
});

const gameManager = new GameManagerService();

wss.on("connection", (socket) => {
  logger.info("New WebSocket connection established (WSS)");
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
    httpsServer.close(() => {
      logger.info("HTTPS server closed");
      process.exit(0);
    });
  });
};

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

const wssPort = config.server.port || 8080;
httpsServer.listen(wssPort, config.server.host, () => {
  logger.info(`WebSocket server started on WSS port ${wssPort}`);
});
