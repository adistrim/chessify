import { WebSocketServer } from "ws";
import { GameManagerService } from "./services/GameManagerService";
import { config } from "./config";
import { logger } from "./utils/logger";

const wss = new WebSocketServer({
  port: config.server.port,
  host: config.server.host,
});

const gameManager = new GameManagerService();

// Handle incoming connections
wss.on("connection", (socket) => {
  logger.info("New WebSocket connection established");

  // Register the connection with the game manager
  gameManager.handleConnection(socket);

  // Handle disconnection
  socket.on("close", () => {
    logger.info("WebSocket connection closed");
    gameManager.handleDisconnect(socket);
  });

  // Handle errors
  socket.on("error", (error) => {
    logger.error("WebSocket error:", error);
  });
});

// Handle server lifecycle
const handleShutdown = () => {
  logger.info("Server shutting down...");

  // Clean up game manager
  gameManager.shutdown();

  // Close WebSocket server
  wss.close(() => {
    logger.info("WebSocket server closed");
    process.exit(0);
  });
};

// Setup graceful shutdown
process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

// Log server startup
logger.info(`WebSocket server started on port ${config.server.port}`);
