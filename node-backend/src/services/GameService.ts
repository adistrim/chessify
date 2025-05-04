import { Chess } from "chess.js";
import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { GameState, Move, Player } from "../models/types";
import { COLORS, GAME_STATUS, GAME_TYPES, MESSAGE_TYPES } from "../models/constants";
import { logger } from "../utils/logger";

/**
 * Manages a single chess game instance between two human players
 */
export class GameService {
  private id: string;
  private player1: Player;
  private player2: Player;
  private chess: Chess;
  private startTime: Date;
  private status: string;
  private endTime?: Date;
  private winner?: string;

  constructor(player1: Player, player2: Player) {
    this.id = uuidv4();
    this.player1 = player1;
    this.player2 = player2;
    this.chess = new Chess();
    this.startTime = new Date();
    this.status = GAME_STATUS.ACTIVE;

    // Initialize the game for both players
    this.sendToPlayer(this.player1.socket, {
      type: MESSAGE_TYPES.INIT_GAME,
      payload: {
        color: COLORS.WHITE,
        gameType: GAME_TYPES.HUMAN_VS_HUMAN
      },
    });

    this.sendToPlayer(this.player2.socket, {
      type: MESSAGE_TYPES.INIT_GAME,
      payload: {
        color: COLORS.BLACK,
        gameType: GAME_TYPES.HUMAN_VS_HUMAN
      },
    });

    logger.info(
      `Human game ${this.id} started between players ${player1.id} and ${player2.id}`,
    );
  }

  /**
   * Process a move from one of the players
   *
   * @param socket WebSocket of the player making the move
   * @param move The move to make
   * @returns true if game is over after this move
   */
  public makeMove(socket: WebSocket, move: Move): boolean {
    // Validate it's the correct player's turn
    const isWhiteTurn = this.chess.turn() === "w";
    const isPlayer1Socket = socket === this.player1.socket;
    const isPlayer2Socket = socket === this.player2.socket;

    if (
      (isWhiteTurn && !isPlayer1Socket) ||
      (!isWhiteTurn && !isPlayer2Socket)
    ) {
      this.sendToPlayer(socket, {
        type: MESSAGE_TYPES.ERROR,
        payload: {
          code: "not_your_turn",
          message: "It's not your turn to move",
        },
      });
      return false;
    }

    try {
      // Attempt to make the move on the chess board
      this.chess.move(move);
    } catch (error) {
      logger.warn(`Invalid move attempt in human game ${this.id}:`, move);
      this.sendToPlayer(socket, {
        type: MESSAGE_TYPES.ERROR,
        payload: {
          code: "invalid_move",
          message: "Invalid move",
        },
      });
      return false;
    }

    // Notify the opponent of the move
    const opponent = isPlayer1Socket
      ? this.player2.socket
      : this.player1.socket;
    this.sendToPlayer(opponent, {
      type: MESSAGE_TYPES.MOVE,
      payload: move,
    });

    // Check if the game is over
    if (this.chess.isGameOver()) {
      this.endGame();
      return true;
    }

    return false;
  }

  /**
   * Get current game state
   */
  public getGameState(): GameState {
    return {
      id: this.id,
      player1: this.player1,
      player2: this.player2,
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime,
      winner: this.winner,
      gameType: GAME_TYPES.HUMAN_VS_HUMAN,
    };
  }

  /**
   * End the game due to completion or other reason
   *
   * @param reason Optional reason for game ending
   */
  public endGame(reason?: string): void {
    this.status = GAME_STATUS.COMPLETED;
    this.endTime = new Date();

    // Determine winner
    if (this.chess.isCheckmate()) {
      this.winner = this.chess.turn() === "w" ? COLORS.BLACK : COLORS.WHITE;
    } else if (this.chess.isDraw()) {
      this.winner = "draw";
    } else if (reason === "player_disconnected") {
      // If player disconnected, other player wins
      this.winner = "player_disconnected";
    }

    // Notify both players
    const gameOverMessage = {
      type: MESSAGE_TYPES.GAME_OVER,
      payload: {
        winner: this.winner,
        reason,
      },
    };

    this.sendToPlayer(this.player1.socket, gameOverMessage);
    this.sendToPlayer(this.player2.socket, gameOverMessage);

    logger.info(`Human game ${this.id} ended. Winner: ${this.winner || "none"}`);
  }

  /**
   * Handle player disconnect
   *
   * @param socket The socket that disconnected
   */
  public handleDisconnect(socket: WebSocket): void {
    if (this.status === GAME_STATUS.COMPLETED) {
      return; // Game is already over, no need to handle disconnect
    }

    const isPlayer1 = socket === this.player1.socket;
    const opponent = isPlayer1 ? this.player2.socket : this.player1.socket;

    this.winner = isPlayer1 ? COLORS.BLACK : COLORS.WHITE;

    this.sendToPlayer(opponent, {
      type: MESSAGE_TYPES.GAME_OVER,
      payload: {
        winner: this.winner,
        reason: "opponent_disconnected",
      },
    });

    this.status = GAME_STATUS.COMPLETED;
    this.endTime = new Date();

    logger.info(`Player disconnected from human game ${this.id}. Game ended.`);
  }

  /**
   * Helper method to send a message to a player
   */
  private sendToPlayer(socket: WebSocket, message: any): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}
