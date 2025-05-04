import { WebSocket } from "ws";
import { z } from "zod";

// Player
export interface Player {
  socket: WebSocket;
  id: string; // Unique identifier for the player
  isAI?: boolean; // Whether this player is an AI
}

// Game
export interface GameState {
  id: string;
  player1: Player;
  player2: Player;
  status: string;
  startTime: Date;
  endTime?: Date;
  winner?: string;
  gameType: string; // Type of game (human vs human or human vs AI)
}

// AI Player Options
export interface AIPlayerOptions {
  skillLevel?: number; // AI skill level (0-20)
  searchDepth?: number; // Search depth for the AI (1-20)
  color?: string; // Color the AI plays as (default: random)
}

// Move
export const MoveSchema = z.object({
  from: z.string().length(2), // e.g., "e2"
  to: z.string().length(2), // e.g., "e4"
  promotion: z.string().optional(), // e.g., "q" for queen promotion
});

export type Move = z.infer<typeof MoveSchema>;

// Message schemas
export const InitGameMessageSchema = z.object({
  type: z.literal("init_game"),
});

export const InitAIGameMessageSchema = z.object({
  type: z.literal("init_ai_game"),
  payload: z.object({
    options: z.object({
      skillLevel: z.number().min(0).max(20).optional(),
      searchDepth: z.number().min(1).max(20).optional(),
      color: z.enum(["white", "black"]).optional(),
    }).optional(),
  }),
});

export const MoveMessageSchema = z.object({
  type: z.literal("move"),
  payload: z.object({
    move: MoveSchema,
  }),
});

export type InitGameMessage = z.infer<typeof InitGameMessageSchema>;
export type InitAIGameMessage = z.infer<typeof InitAIGameMessageSchema>;
export type MoveMessage = z.infer<typeof MoveMessageSchema>;

// Combined message type
export const MessageSchema = z.discriminatedUnion("type", [
  InitGameMessageSchema,
  InitAIGameMessageSchema,
  MoveMessageSchema,
]);

export type Message = z.infer<typeof MessageSchema>;

// Outgoing messages to client
export interface GameInitResponse {
  type: string;
  payload: {
    color: string;
    gameType: string;
  };
}

export interface MoveResponse {
  type: string;
  payload: Move;
}

export interface GameOverResponse {
  type: string;
  payload: {
    winner: string;
    reason?: string;
  };
}

export interface ErrorResponse {
  type: string;
  payload: {
    code: string;
    message: string;
  };
}
