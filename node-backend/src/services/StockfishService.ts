import { Chess } from "chess.js";
import { spawn } from "child_process";
import { logger } from "../utils/logger";
import { Move } from "../models/types";

/**
 * Service to interact with the Stockfish chess engine
 */
export class StockfishService {
  private stockfish: ReturnType<typeof spawn> | null = null;
  private ready: boolean = false;
  private movePromiseResolve: ((move: Move) => void) | null = null;
  private movesHistory: string[] = [];
  private skillLevel: number;
  private searchDepth: number;

  /**
   * Create a new Stockfish service instance
   * 
   * @param skillLevel Stockfish skill level (0-20)
   * @param searchDepth Stockfish search depth (1-20) 
   */
  constructor(skillLevel: number = 10, searchDepth: number = 12) {
    this.skillLevel = Math.min(20, Math.max(0, skillLevel));
    this.searchDepth = Math.min(20, Math.max(1, searchDepth)); 
    this.initialize();
  }

  /**
   * Initialize the Stockfish engine
   */
  private initialize(): void {
    try {
      // Try to spawn the Stockfish process
      this.stockfish = spawn("stockfish");
      
      if (!this.stockfish || !this.stockfish.stdin || !this.stockfish.stdout) {
        throw new Error("Failed to start Stockfish process");
      }

      // Handle Stockfish output
      this.stockfish.stdout.on("data", (data) => {
        const output = data.toString();
        
        // If Stockfish is ready
        if (output.includes("uciok")) {
          this.configureEngine();
        }
        
        // If Stockfish has found a best move
        else if (output.includes("bestmove")) {
          this.handleBestMove(output);
        }
      });

      // Handle errors
      this.stockfish.stderr?.on("data", (data) => {
        logger.error(`Stockfish error: ${data}`);
      });

      this.stockfish.on("error", (error) => {
        logger.error(`Stockfish process error: ${error.message}`);
        this.ready = false;
      });

      this.stockfish.on("close", (code) => {
        logger.info(`Stockfish process exited with code ${code}`);
        this.ready = false;
      });

      // Send UCI command to initialize the engine
      this.sendCommand("uci");
      
    } catch (error) {
      logger.error("Failed to initialize Stockfish engine:", error);
      throw new Error("Failed to initialize Stockfish engine. Make sure Stockfish is installed on the system.");
    }
  }

  /**
   * Configure the Stockfish engine with appropriate settings
   */
  private configureEngine(): void {
    // Set skill level (0-20)
    this.sendCommand(`setoption name Skill Level value ${this.skillLevel}`);
    
    // Set search depth
    this.sendCommand(`setoption name MultiPV value ${this.searchDepth}`);
    
    // Other common settings
    this.sendCommand("setoption name Hash value 128"); // Use 128MB of memory for hash
    this.sendCommand("setoption name Threads value 4"); // Use 4 threads
    
    // Indicate engine is ready
    this.sendCommand("isready");
    this.ready = true;
    logger.info("Stockfish engine initialized and ready");
  }

  /**
   * Send a command to the Stockfish engine
   */
  private sendCommand(command: string): void {
    if (!this.stockfish || !this.stockfish.stdin) {
      logger.error("Cannot send command to Stockfish: engine not initialized");
      return;
    }

    this.stockfish.stdin.write(command + "\n");
  }

  /**
   * Process the best move output from Stockfish
   */
  private handleBestMove(output: string): void {
    const bestMoveMatch = output.match(/bestmove\s+(\w+)(\s+ponder\s+(\w+))?/);
    
    if (bestMoveMatch && bestMoveMatch[1]) {
      const moveString = bestMoveMatch[1];
      
      // Convert UCI move format (e.g., "e2e4") to our move format
      const from = moveString.substring(0, 2);
      const to = moveString.substring(2, 4);
      
      // Handle promotion if present
      let promotion;
      if (moveString.length > 4) {
        promotion = moveString.substring(4, 5);
      }
      
      const move: Move = { from, to };
      if (promotion) {
        move.promotion = promotion;
      }
      
      // Resolve the promise with the move
      if (this.movePromiseResolve) {
        this.movePromiseResolve(move);
        this.movePromiseResolve = null;
      }
    }
  }

  /**
   * Get the best move for the current position
   * 
   * @param chessInstance Current chess.js instance
   * @returns Promise that resolves to the chosen move
   */
  public getBestMove(chessInstance: Chess): Promise<Move> {
    return new Promise((resolve) => {
      if (!this.ready) {
        logger.error("Stockfish engine not ready");
        throw new Error("Stockfish engine not ready");
      }
      
      // Store the resolve function
      this.movePromiseResolve = resolve;
      
      // Set the position using FEN string
      const fen = chessInstance.fen();
      this.sendCommand("position fen " + fen);
      
      // Ask Stockfish to find the best move
      this.sendCommand(`go depth ${this.searchDepth}`);
    });
  }

  /**
   * Clean up resources when shutting down
   */
  public shutdown(): void {
    if (this.stockfish) {
      this.sendCommand("quit");
      this.stockfish = null;
    }
    logger.info("Stockfish engine shutdown");
  }
}