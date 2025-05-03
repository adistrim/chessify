import { WebSocket } from "ws";
import { z } from "zod";

// Player
export interface Player {
  socket: WebSocket;
  id: string; // Unique identifier for the player
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

export const MoveMessageSchema = z.object({
  type: z.literal("move"),
  payload: z.object({
    move: MoveSchema,
  }),
});

export type InitGameMessage = z.infer<typeof InitGameMessageSchema>;
export type MoveMessage = z.infer<typeof MoveMessageSchema>;

// Combined message type
export const MessageSchema = z.discriminatedUnion("type", [
  InitGameMessageSchema,
  MoveMessageSchema,
]);

export type Message = z.infer<typeof MessageSchema>;

// Outgoing messages to client
export interface GameInitResponse {
  type: string;
  payload: {
    color: string;
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
