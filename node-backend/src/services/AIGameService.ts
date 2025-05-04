import { WebSocket } from "ws";
import { Chess } from "chess.js";
import { v4 as uuidv4 } from "uuid";
import { COLORS, GAME_STATUS, GAME_TYPES, MESSAGE_TYPES } from "../models/constants";
import { GameState, Move, Player, AIPlayerOptions } from "../models/types";
import { StockfishService } from "./StockfishService";
import { logger } from "../utils/logger";

/**
 * Manages a chess game between a human player and the Stockfish AI
 */
export class AIGameService {
  private id: string;
  private humanPlayer: Player;
  private aiPlayer: Player;
  private chess: Chess;
  private startTime: Date;
  private status: string;
  private endTime?: Date;
  private winner?: string;
  private stockfish: StockfishService;
  private humanPlayerColor: string;
  private aiPlayerColor: string;

  /**
   * Create a new AI game
   * 
   * @param humanPlayer The human player
   * @param options Options for the AI player
   */
  constructor(humanPlayer: Player, options: AIPlayerOptions = {}) {
    this.id = uuidv4();
    this.humanPlayer = humanPlayer;
    
    // Create virtual AI player
    this.aiPlayer = {
      id: `ai-${uuidv4()}`,
      socket: {} as WebSocket, // Placeholder socket
      isAI: true
    };

    // Set default options if not provided
    const skillLevel = options.skillLevel || 10; // Default medium difficulty
    const searchDepth = options.searchDepth || 12;
    
    // Initialize the Stockfish engine
    this.stockfish = new StockfishService(skillLevel, searchDepth);
    
    // Initialize chess game
    this.chess = new Chess();
    this.startTime = new Date();
    this.status = GAME_STATUS.ACTIVE;
    
    // Determine colors
    if (options.color) {
      this.humanPlayerColor = options.color;
      this.aiPlayerColor = options.color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    } else {
      // Randomly assign colors if not specified
      this.humanPlayerColor = Math.random() < 0.5 ? COLORS.WHITE : COLORS.BLACK;
      this.aiPlayerColor = this.humanPlayerColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    }

    // Notify human player about game initialization
    this.sendToHumanPlayer({
      type: MESSAGE_TYPES.INIT_GAME,
      payload: {
        color: this.humanPlayerColor,
        gameType: GAME_TYPES.HUMAN_VS_AI
      },
    });

    logger.info(`AI Game ${this.id} started for player ${humanPlayer.id}, AI difficulty: ${skillLevel}`);
    
    // If AI goes first (plays as white), make its move
    if (this.aiPlayerColor === COLORS.WHITE) {
      this.makeAIMove();
    }
  }

  /**
   * Make a move on behalf of the human player
   * 
   * @param move The move to make
   * @returns true if game is over after this move
   */
  public makeHumanMove(move: Move): boolean {
    // Check if it's the human player's turn
    const isWhiteTurn = this.chess.turn() === 'w';
    const isHumanWhite = this.humanPlayerColor === COLORS.WHITE;
    
    if ((isWhiteTurn && !isHumanWhite) || (!isWhiteTurn && isHumanWhite)) {
      this.sendToHumanPlayer({
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
      logger.warn(`Invalid move attempt in AI game ${this.id}:`, move);
      this.sendToHumanPlayer({
        type: MESSAGE_TYPES.ERROR,
        payload: {
          code: "invalid_move",
          message: "Invalid move",
        },
      });
      return false;
    }
    
    // Check if the game is over after human move
    if (this.chess.isGameOver()) {
      this.endGame();
      return true;
    }
    
    // If game continues, make AI move
    setTimeout(() => this.makeAIMove(), 500); // Small delay for better UX
    
    return false;
  }
  
  /**
   * Make a move using the AI engine
   */
  private async makeAIMove(): Promise<void> {
    if (this.status !== GAME_STATUS.ACTIVE) {
      return; // Don't make moves if game is over
    }
    
    try {
      // Get the best move from Stockfish
      const move = await this.stockfish.getBestMove(this.chess);
      
      // Make the move on the board
      this.chess.move(move);
      
      // Send the move to the human player
      this.sendToHumanPlayer({
        type: MESSAGE_TYPES.MOVE,
        payload: move,
      });
      
      // Check if the game is over after AI move
      if (this.chess.isGameOver()) {
        this.endGame();
      }
    } catch (error) {
      logger.error(`AI move error in game ${this.id}:`, error);
      
      this.sendToHumanPlayer({
        type: MESSAGE_TYPES.ERROR,
        payload: {
          code: "ai_engine_error",
          message: "The AI encountered an error while calculating its move",
        },
      });
    }
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
      const winningColor = this.chess.turn() === 'w' ? COLORS.BLACK : COLORS.WHITE;
      this.winner = winningColor;
    } else if (this.chess.isDraw()) {
      this.winner = "draw";
    } else if (reason === "player_disconnected") {
      this.winner = this.aiPlayerColor;
    } else if (reason === "ai_error") {
      this.winner = this.humanPlayerColor;
    }
    
    // Notify human player
    this.sendToHumanPlayer({
      type: MESSAGE_TYPES.GAME_OVER,
      payload: {
        winner: this.winner,
        reason,
      },
    });
    
    // Clean up resources
    this.stockfish.shutdown();
    
    logger.info(`AI Game ${this.id} ended. Winner: ${this.winner || "none"}`);
  }
  
  /**
   * Handle human player disconnect
   */
  public handleDisconnect(): void {
    if (this.status === GAME_STATUS.COMPLETED) {
      return; // Game is already over
    }
    
    this.endGame("player_disconnected");
  }
  
  /**
   * Get current game state
   */
  public getGameState(): GameState {
    return {
      id: this.id,
      player1: this.humanPlayerColor === COLORS.WHITE ? this.humanPlayer : this.aiPlayer,
      player2: this.humanPlayerColor === COLORS.WHITE ? this.aiPlayer : this.humanPlayer,
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime,
      winner: this.winner,
      gameType: GAME_TYPES.HUMAN_VS_AI,
    };
  }
  
  /**
   * Helper method to send a message to the human player
   */
  private sendToHumanPlayer(message: any): void {
    if (this.humanPlayer.socket.readyState === WebSocket.OPEN) {
      this.humanPlayer.socket.send(JSON.stringify(message));
    }
  }
  
  /**
   * Perform graceful shutdown of the AI game
   */
  public shutdown(): void {
    this.stockfish.shutdown();
    if (this.status === GAME_STATUS.ACTIVE) {
      this.endGame("server_shutdown");
    }
  }
}