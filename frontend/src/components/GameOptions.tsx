import { useState } from "react";
import { Button } from "./Button";
import { INIT_GAME, INIT_AI_GAME } from "../screens/Game";

interface GameOptionsProps {
  socket: WebSocket;
  onGameStart: () => void;
}

export const GameOptions = ({ socket, onGameStart }: GameOptionsProps) => {
  const [gameMode, setGameMode] = useState<"human" | "ai">("human");
  const [aiOptions, setAiOptions] = useState({
    skillLevel: 10,
    color: "random" as "white" | "black" | "random",
  });

  const handleStartGame = () => {
    if (gameMode === "human") {
      socket.send(JSON.stringify({
        type: INIT_GAME,
      }));
    } else {
      // Define typed interfaces for the AI game message
      interface AIGameOptions {
        skillLevel: number;
        color?: "white" | "black";
      }
      
      interface AIGamePayload {
        options: AIGameOptions;
      }
      
      interface AIGameMessage {
        type: string;
        payload: AIGamePayload;
      }
      
      // Create properly typed payload
      const options: AIGameOptions = {
        skillLevel: aiOptions.skillLevel,
      };
      
      // Only add color if it's not random
      if (aiOptions.color !== "random") {
        options.color = aiOptions.color;
      }
      
      const payload: AIGameMessage = {
        type: INIT_AI_GAME,
        payload: {
          options
        }
      };
      
      socket.send(JSON.stringify(payload));
    }
    onGameStart();
  };

  return (
    <div className="bg-[#2A2B2D] p-6 rounded-lg shadow-lg text-white w-full">
      <h2 className="text-2xl font-bold mb-4 text-center">Game Options</h2>
      
      <div className="mb-6">
        <label className="block mb-2 font-medium">Game Mode</label>
        <div className="flex space-x-4">
          <button
            onClick={() => setGameMode("human")}
            className={`px-4 py-2 rounded-md ${
              gameMode === "human"
                ? "bg-[#769656] text-white"
                : "bg-gray-700 text-gray-300"
            }`}
          >
            Play vs Human
          </button>
          <button
            onClick={() => setGameMode("ai")}
            className={`px-4 py-2 rounded-md ${
              gameMode === "ai"
                ? "bg-[#769656] text-white"
                : "bg-gray-700 text-gray-300"
            }`}
          >
            Play vs AI
          </button>
        </div>
      </div>

      {gameMode === "ai" && (
        <>
          <div className="mb-6">
            <label className="block mb-2 font-medium">
              AI Difficulty: {aiOptions.skillLevel}
            </label>
            <input
              type="range"
              min="0"
              max="20"
              value={aiOptions.skillLevel}
              onChange={(e) =>
                setAiOptions({
                  ...aiOptions,
                  skillLevel: parseInt(e.target.value),
                })
              }
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs mt-1">
              <span>Beginner</span>
              <span>Intermediate</span>
              <span>Expert</span>
            </div>
          </div>

          <div className="mb-6">
            <label className="block mb-2 font-medium">Play as</label>
            <div className="flex space-x-4">
              <button
                onClick={() => setAiOptions({ ...aiOptions, color: "white" })}
                className={`px-4 py-2 rounded-md ${
                  aiOptions.color === "white"
                    ? "bg-[#769656] text-white"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                White
              </button>
              <button
                onClick={() => setAiOptions({ ...aiOptions, color: "black" })}
                className={`px-4 py-2 rounded-md ${
                  aiOptions.color === "black"
                    ? "bg-[#769656] text-white"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                Black
              </button>
              <button
                onClick={() => setAiOptions({ ...aiOptions, color: "random" })}
                className={`px-4 py-2 rounded-md ${
                  aiOptions.color === "random"
                    ? "bg-[#769656] text-white"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                Random
              </button>
            </div>
          </div>
        </>
      )}

      <div className="mt-6 flex justify-center">
        <Button onClick={handleStartGame}>
          {gameMode === "human" ? "Find Opponent" : "Start Game"}
        </Button>
      </div>
    </div>
  );
};