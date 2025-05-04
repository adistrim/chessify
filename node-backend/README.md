# Chessify Backend

A WebSocket-based backend server for chess games, supporting both human vs. human and human vs. AI gameplay.

## Features

- Real-time chess games via WebSocket
- Human vs. Human gameplay
- Human vs. AI gameplay with configurable difficulty
- Automatic game cleanup for inactive games

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- [Stockfish chess engine](https://stockfishchess.org/download/) installed on your system

## Installation

1. Install dependencies:

```bash
npm install
```

2. Make sure Stockfish is installed on your system and available in your PATH.

   - **Linux/macOS**:
     ```bash
     # Verify Stockfish is installed and accessible
     which stockfish
     ```

   - **Windows**:
     ```powershell
     # Verify Stockfish is installed and accessible
     where.exe stockfish
     ```

   If Stockfish is not found, download it from [stockfishchess.org](https://stockfishchess.org/download/) and add it to your PATH.

## Configuration

Configuration options are available in `src/config/index.ts`:

- **Server settings**: Port, host
- **Game settings**: Inactivity timeout, cleanup intervals
- **Logging levels**

## Running the Server

```bash
npm start
```

The WebSocket server will start on the configured port (default: 8080).

## WebSocket API

### Client to Server Messages

#### Start a Human vs. Human Game
```json
{
  "type": "init_game"
}
```

#### Start a Human vs. AI Game
```json
{
  "type": "init_ai_game",
  "payload": {
    "options": {
      "skillLevel": 10,
      "searchDepth": 12,
      "color": "white"
    }
  }
}
```
All options are optional. Default AI skill level is 10 (range 0-20).

#### Make a Move
```json
{
  "type": "move",
  "payload": {
    "move": {
      "from": "e2",
      "to": "e4",
      "promotion": "q"  // Optional, only needed for pawn promotion
    }
  }
}
```

### Server to Client Messages

#### Game Initialization
```json
{
  "type": "init_game",
  "payload": {
    "color": "white",
    "gameType": "human_vs_human"
  }
}
```

#### Move Update
```json
{
  "type": "move",
  "payload": {
    "from": "e7",
    "to": "e5"
  }
}
```

#### Game Over
```json
{
  "type": "game_over",
  "payload": {
    "winner": "white",
    "reason": "checkmate"
  }
}
```

#### Error
```json
{
  "type": "error",
  "payload": {
    "code": "invalid_move",
    "message": "Invalid move"
  }
}
```
