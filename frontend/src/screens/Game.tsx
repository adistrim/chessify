import { useEffect, useState } from "react";
import { ChessBoard } from "../components/ChessBoard";
import { useSocket } from "../hooks/useSocket";
import { Chess } from "chess.js";
import { GameOptions } from "../components/GameOptions";
import { GameStatus } from "../components/GameStatus";
import { chessLoadingMessages } from "../data/messages";

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
  const [connectionState, setConnectionState] = useState<
    "connecting" | "failed"
  >("connecting");

  useEffect(() => {
    const connectionTimeout = setTimeout(() => {
      if (!socket) {
        setConnectionState("failed");
      }
    }, 5000);

    if (socket) {
      clearTimeout(connectionTimeout);
    }

    return () => {
      clearTimeout(connectionTimeout);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

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
    if (connectionState === "connecting") {
      const randomMessage =
        chessLoadingMessages[
          Math.floor(Math.random() * chessLoadingMessages.length)
        ];

      return (
        <div className="flex justify-center items-center h-full">
          <div className="text-center max-w-md p-8 bg-gray-800 bg-opacity-70 rounded-lg shadow-lg">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="animate-bounce absolute inset-0 flex items-center justify-center">
                <img src="/chess.svg" />
              </div>
            </div>
            <h1 className="text-2xl text-white font-bold mb-4">
              Setting up the board...
            </h1>
            <p className="text-gray-300 italic text-sm">{randomMessage}</p>
            <div className="mt-6 flex justify-center space-x-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full bg-white opacity-75 animate-pulse`}
                  style={{ animationDelay: `${i * 200}ms` }}
                ></div>
              ))}
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="flex justify-center items-center h-full flex-col p-8">
          <h1 className="text-3xl text-white mb-4">
            Unable to connect to server
          </h1>
          <p className="text-white text-center max-w-md">
            It costs money to keep a websocket server running 24/7. If you want
            to try the platform or want to know more about it, please connect
            with:
          </p>
          <a
            href="mailto:araj@adistrim.in"
            className="text-blue-400 hover:text-blue-300 mt-2 underline"
          >
            araj@adistrim.in
          </a>
        </div>
      );
    }
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
