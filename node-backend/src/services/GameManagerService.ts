import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { GameService } from "./GameService";
import { AIGameService } from "./AIGameService";
import { AIPlayerOptions, Player, Move, InitAIGameMessage, MoveMessage } from "../models/types";
import { MESSAGE_TYPES, GAME_TYPES } from "../models/constants";
import { logger } from "../utils/logger";
import { validateMessage } from "../utils/validators";
import { config } from "../config";

/**
 * Manages active games and matchmaking
 */
export class GameManagerService {
  private games: Map<string, GameService | AIGameService>;
  private players: Map<WebSocket, Player>;
  private waitingPlayer: Player | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.games = new Map();
    this.players = new Map();

    // Setup interval for cleanup of inactive games
    this.cleanupInterval = setInterval(
      () => this.cleanupInactiveGames(),
      config.game.cleanupInterval,
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
          
        case MESSAGE_TYPES.INIT_AI_GAME:
          let options: AIPlayerOptions = {};
          
          // Since we're using discriminated union with Zod, we can safely assert the message type
          const aiGameMessage = validatedMessage as InitAIGameMessage;
          
          // Process AI game options if provided
          if (aiGameMessage.payload && aiGameMessage.payload.options) {
            options = aiGameMessage.payload.options;
          }
          
          this.handleInitAIGame(player, options);
          break;

        case MESSAGE_TYPES.MOVE:
          // Again, with our discriminated union, we can safely assert the message type
          const moveMessage = validatedMessage as MoveMessage;
          this.handleMove(socket, moveMessage.payload.move);
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
   * Handle a request to initialize a new game with another human player
   */
  private handleInitGame(player: Player): void {
    if (this.waitingPlayer) {
      // We have another player waiting, start a game!
      const game = new GameService(this.waitingPlayer, player);
      this.games.set(game.getGameState().id, game);
      this.waitingPlayer = null;

      logger.info("New human vs human game created between waiting players");
    } else {
      // No one waiting, this player becomes the waiting player
      this.waitingPlayer = player;
      logger.info(`Player ${player.id} is waiting for a human opponent`);
    }
  }

  /**
   * Handle a request to initialize a new game with an AI opponent
   */
  private handleInitAIGame(player: Player, options: AIPlayerOptions): void {
    try {
      // Start a new game with AI
      const aiGame = new AIGameService(player, options);
      this.games.set(aiGame.getGameState().id, aiGame);
      
      logger.info(`New AI game created for player ${player.id}`);
    } catch (error) {
      logger.error(`Failed to create AI game for player ${player.id}:`, error);
      
      // Send error back to client
      player.socket.send(
        JSON.stringify({
          type: MESSAGE_TYPES.ERROR,
          payload: {
            code: "ai_initialization_failed",
            message: "Failed to initialize AI game. Please try again.",
          },
        })
      );
    }
  }

  /**
   * Handle a move request from a player
   */
  private handleMove(socket: WebSocket, move: Move): void {
    // Find which game this player is part of
    let playerGame: GameService | AIGameService | undefined;

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

    // Process the move based on game type
    let gameOver = false;
    
    if (playerGame instanceof AIGameService) {
      // Handle move in AI game
      gameOver = playerGame.makeHumanMove(move);
    } else {
      // Handle move in regular human vs human game
      gameOver = playerGame.makeMove(socket, move);
    }

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
    const inactivityThreshold = config.game.inactivityTimeout;

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
   * Get stats about current games
   */
  public getStats(): { totalGames: number, humanGames: number, aiGames: number } {
    let humanGames = 0;
    let aiGames = 0;
    
    for (const game of this.games.values()) {
      const state = game.getGameState();
      if (state.gameType === GAME_TYPES.HUMAN_VS_HUMAN) {
        humanGames++;
      } else {
        aiGames++;
      }
    }
    
    return {
      totalGames: this.games.size,
      humanGames,
      aiGames
    };
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
