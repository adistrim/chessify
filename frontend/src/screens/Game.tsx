import { useEffect, useState } from "react";
import { ChessBoard } from "../components/ChessBoard";
import { useSocket } from "../hooks/useSocket";
import { Chess } from "chess.js";
import { GameOptions } from "../components/GameOptions";
import { GameStatus } from "../components/GameStatus";

export const INIT_GAME = "init_game";
export const INIT_AI_GAME = "init_ai_game";
export const MOVE = "move";
export const GAME_OVER = "game_over";
export const ERROR = "error";

export const Game = () => {
  const socket = useSocket();
  const [chess] = useState(new Chess());
  const [board, setBoard] = useState(chess.board());
  const [started, setStarted] = useState(false);
  const [gameState, setGameState] = useState({
    playerColor: "",
    gameType: "",
    opponent: "",
    status: "waiting", // waiting, active, completed
  });
  const [gameResult, setGameResult] = useState<{
    winner: string;
    reason?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("Received message:", message);

      switch (message.type) {
        case INIT_GAME:
          setBoard(chess.board());
          setStarted(true);
          setGameState({
            playerColor: message.payload.color,
            gameType: message.payload.gameType,
            opponent:
              message.payload.gameType === "human_vs_human" ? "Human" : "AI",
            status: "active",
          });
          break;

        case MOVE:
          const move = message.payload;
          chess.move(move);
          setBoard(chess.board());
          break;

        case GAME_OVER:
          setGameResult(message.payload);
          setGameState((prev) => ({ ...prev, status: "completed" }));
          break;

        case ERROR:
          setError(`Error: ${message.payload.message}`);
          setTimeout(() => setError(null), 5000); // Clear error after 5 seconds
          break;

        default:
          console.warn("Unknown message type:", message.type);
      }
    };

    return () => {
      socket.onmessage = null;
    };
  }, [chess, socket]);

  // Function to reset the game state
  const resetGame = () => {
    chess.reset();
    setBoard(chess.board());
    setStarted(false);
    setGameResult(null);
    setGameState({
      playerColor: "",
      gameType: "",
      opponent: "",
      status: "waiting",
    });
    setError(null);
  };

  if (!socket) {
    return (
      <div className="flex justify-center items-center h-full">
        <h1 className="text-4xl text-white">Connecting to server...</h1>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <div className="pt-8 max-w-screen-lg w-full">
        {error && (
          <div className="bg-red-500 text-white p-2 mb-4 rounded text-center">
            {error}
          </div>
        )}

        <div className="flex gap-4 w-full">
          <div className="col-span-1 md:col-span-5 w-full flex justify-center">
            <ChessBoard
              chess={chess}
              setBoard={setBoard}
              socket={socket}
              board={board}
            />
          </div>

          <div className="w-full">
            {!started ? (
              <GameOptions socket={socket} onGameStart={() => {}} />
            ) : (
              <GameStatus
                gameState={gameState}
                gameResult={gameResult}
                onNewGame={resetGame}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
