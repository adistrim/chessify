import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { GameService } from "./GameService";
import { Player, Move } from "../models/types";
import { MESSAGE_TYPES } from "../models/constants";
import { logger } from "../utils/logger";
import { validateMessage } from "../utils/validators";

/**
 * Manages active games and matchmaking
 */
export class GameManagerService {
  private games: Map<string, GameService>;
  private players: Map<WebSocket, Player>;
  private waitingPlayer: Player | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.games = new Map();
    this.players = new Map();

    // Setup interval for cleanup of inactive games
    this.cleanupInterval = setInterval(
      () => this.cleanupInactiveGames(),
      5 * 60 * 1000,
    );
  }

  /**
   * Handle a new WebSocket connection
   */
  public handleConnection(socket: WebSocket): void {
    const playerId = uuidv4();
    const player: Player = { socket, id: playerId };

    // Store the player
    this.players.set(socket, player);

    // Setup message handler
    socket.on("message", (data) => {
      this.handleMessage(socket, data.toString());
    });

    logger.info(`Player ${playerId} connected`);
  }

  /**
   * Handle a WebSocket disconnection
   */
  public handleDisconnect(socket: WebSocket): void {
    const player = this.players.get(socket);

    if (!player) {
      return; // Unknown player, nothing to clean up
    }

    logger.info(`Player ${player.id} disconnected`);

    // If player was waiting for a game, remove them from waiting
    if (this.waitingPlayer && this.waitingPlayer.socket === socket) {
      this.waitingPlayer = null;
    }

    // Find any games this player was participating in
    for (const [gameId, game] of this.games.entries()) {
      const gameState = game.getGameState();

      if (
        gameState.player1.socket === socket ||
        gameState.player2.socket === socket
      ) {
        // Handle player disconnect in the game
        game.handleDisconnect(socket);

        // Remove the game from active games
        this.games.delete(gameId);
      }
    }

    // Remove the player from our records
    this.players.delete(socket);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(socket: WebSocket, message: string): void {
    const player = this.players.get(socket);

    if (!player) {
      logger.warn("Received message from unknown player");
      return;
    }

    try {
      // Validate the message format
      const validatedMessage = validateMessage(message);

      switch (validatedMessage.type) {
        case MESSAGE_TYPES.INIT_GAME:
          this.handleInitGame(player);
          break;

        case MESSAGE_TYPES.MOVE:
          // TypeScript needs to narrow the type before accessing payload
          if (
            "payload" in validatedMessage &&
            "move" in validatedMessage.payload
          ) {
            this.handleMove(socket, validatedMessage.payload.move);
          } else {
            throw new Error("Invalid move message format");
          }
          break;

        default:
          logger.warn(
            `Unknown message type: ${(validatedMessage as any).type}`,
          );
      }
    } catch (error) {
      logger.error(`Error processing message from player ${player.id}:`, error);

      // Send error back to client if possible
      try {
        socket.send(
          JSON.stringify({
            type: MESSAGE_TYPES.ERROR,
            payload: {
              code: "invalid_message",
              message: error instanceof Error ? error.message : "Unknown error",
            },
          }),
        );
      } catch (sendError) {
        logger.error("Failed to send error message back to client", sendError);
      }
    }
  }

  /**
   * Handle a request to initialize a new game
   */
  private handleInitGame(player: Player): void {
    if (this.waitingPlayer) {
      // We have another player waiting, start a game!
      const game = new GameService(this.waitingPlayer, player);
      this.games.set(game.getGameState().id, game);
      this.waitingPlayer = null;

      logger.info("New game created between waiting players");
    } else {
      // No one waiting, this player becomes the waiting player
      this.waitingPlayer = player;
      logger.info(`Player ${player.id} is waiting for an opponent`);
    }
  }

  /**
   * Handle a move request from a player
   */
  private handleMove(socket: WebSocket, move: Move): void {
    // Find which game this player is part of
    let playerGame: GameService | undefined;

    for (const game of this.games.values()) {
      const state = game.getGameState();
      if (state.player1.socket === socket || state.player2.socket === socket) {
        playerGame = game;
        break;
      }
    }

    if (!playerGame) {
      logger.warn(`Player tried to move but isn't in a game`);
      socket.send(
        JSON.stringify({
          type: MESSAGE_TYPES.ERROR,
          payload: {
            code: "no_active_game",
            message: "You are not currently in an active game",
          },
        }),
      );
      return;
    }

    // Process the move
    const gameOver = playerGame.makeMove(socket, move);

    // If game is over, clean it up
    if (gameOver) {
      const gameId = playerGame.getGameState().id;
      this.games.delete(gameId);
      logger.info(`Game ${gameId} completed and removed from active games`);
    }
  }

  /**
   * Clean up inactive games periodically
   */
  private cleanupInactiveGames(): void {
    const now = new Date();
    const inactivityThreshold = 30 * 60 * 1000; // 30 minutes in ms

    for (const [gameId, game] of this.games.entries()) {
      const state = game.getGameState();

      // Check if game has been active for too long
      if (now.getTime() - state.startTime.getTime() > inactivityThreshold) {
        logger.info(`Cleaning up inactive game ${gameId}`);

        // End the game due to inactivity
        game.endGame("inactivity");
        this.games.delete(gameId);
      }
    }
  }

  /**
   * Properly stop the manager and clean up resources
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all games gracefully
    for (const game of this.games.values()) {
      game.endGame("server_shutdown");
    }

    this.games.clear();
    this.players.clear();

    logger.info("GameManagerService shutdown complete");
  }
}
