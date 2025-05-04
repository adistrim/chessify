import { Button } from "./Button";

interface GameStatusProps {
  gameState: {
    playerColor: string;
    gameType: string;
    opponent: string;
    status: string;
  };
  gameResult: {
    winner: string;
    reason?: string;
  } | null;
  onNewGame: () => void;
}

export const GameStatus = ({
  gameState,
  gameResult,
  onNewGame,
}: GameStatusProps) => {
  const getStatusMessage = () => {
    switch (gameState.status) {
      case "waiting":
        return "Waiting for opponent...";
      case "active":
        return "Game in progress";
      case "completed":
        return "Game completed";
      default:
        return "Unknown status";
    }
  };

  const getWinnerMessage = () => {
    if (!gameResult) return "";

    if (gameResult.winner === "draw") {
      return "Game ended in a draw";
    }

    if (gameResult.winner === gameState.playerColor) {
      return "You won!";
    } else {
      return "You lost";
    }
  };

  const getReasonMessage = () => {
    if (!gameResult?.reason) return "";

    switch (gameResult.reason) {
      case "checkmate":
        return "by checkmate";
      case "stalemate":
        return "by stalemate";
      case "insufficient_material":
        return "due to insufficient material";
      case "threefold_repetition":
        return "by threefold repetition";
      case "opponent_disconnected":
        return "opponent disconnected";
      case "inactivity":
        return "due to inactivity";
      default:
        return gameResult.reason;
    }
  };

  return (
    <div className="bg-[#2A2B2D] text-white p-4 rounded-lg">
      <h2 className="text-xl font-bold mb-3 text-center">Game Status</h2>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-300">Game Type:</span>
          <span className="font-medium">
            {gameState.gameType === "human_vs_human" ? "vs Human" : "vs AI"}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-300">Playing as:</span>
          <span className="font-medium capitalize">
            {gameState.playerColor}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-300">Status:</span>
          <span className="font-medium">{getStatusMessage()}</span>
        </div>
      </div>

      {gameResult && (
        <div className="bg-gray-800 p-3 rounded-lg mb-4">
          <p className="font-bold text-center">{getWinnerMessage()}</p>
          {getReasonMessage() && (
            <p className="text-sm text-center text-gray-400">
              {getReasonMessage()}
            </p>
          )}
        </div>
      )}

      {gameState.status === "completed" && (
        <Button onClick={onNewGame}>New Game</Button>
      )}
    </div>
  );
};
