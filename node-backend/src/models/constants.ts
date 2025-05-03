// Message types for client-server communication
export const MESSAGE_TYPES = {
  INIT_GAME: "init_game",
  MOVE: "move",
  GAME_OVER: "game_over",
  ERROR: "error",
};

// Color types
export const COLORS = {
  WHITE: "white",
  BLACK: "black",
};

// Game status
export const GAME_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  COMPLETED: "completed",
};

// Error codes
export const ERROR_CODES = {
  INVALID_MOVE: "invalid_move",
  NOT_YOUR_TURN: "not_your_turn",
  GAME_NOT_FOUND: "game_not_found",
  INVALID_MESSAGE_FORMAT: "invalid_message_format",
  INTERNAL_ERROR: "internal_error",
};
