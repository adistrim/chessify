import { Chess, Color, PieceSymbol, Square } from "chess.js";
import { useEffect, useState } from "react";
import { MOVE } from "../screens/Game";

interface ChessBoardProps {
  chess: Chess;
  setBoard: React.Dispatch<
    React.SetStateAction<
      ({
        square: Square;
        type: PieceSymbol;
        color: Color;
      } | null)[][]
    >
  >;
  board: ({
    square: Square;
    type: PieceSymbol;
    color: Color;
  } | null)[][];
  socket: WebSocket;
}

export const ChessBoard = ({
  chess,
  board,
  socket,
  setBoard,
}: ChessBoardProps) => {
  const [selectedSquare, setSelectedSquare] = useState<null | Square>(null);
  const [possibleMoves, setPossibleMoves] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(
    null,
  );

  // Calculate possible moves when a square is selected
  useEffect(() => {
    if (selectedSquare) {
      try {
        // Get all legal moves from the selected square
        const moves = chess.moves({
          square: selectedSquare,
          verbose: true,
        });

        // Extract the destination squares
        const destinations = moves.map((move) => move.to as Square);
        setPossibleMoves(destinations);
      } catch (error) {
        console.error("Error calculating possible moves:", error);
        setPossibleMoves([]);
      }
    } else {
      setPossibleMoves([]);
    }
  }, [selectedSquare, chess]);

  // Handle square click
  const handleSquareClick = (squareCoord: Square) => {
    // If no square is selected yet
    if (!selectedSquare) {
      // Only allow selecting squares with pieces that match the current turn
      const piece = chess.get(squareCoord);
      if (piece && piece.color === (chess.turn() === "w" ? "w" : "b")) {
        setSelectedSquare(squareCoord);
      }
    }
    // If a square is already selected
    else {
      // If clicking the same square, deselect it
      if (squareCoord === selectedSquare) {
        setSelectedSquare(null);
        return;
      }

      // Check if the move is legal
      if (possibleMoves.includes(squareCoord)) {
        // Send move to server
        socket.send(
          JSON.stringify({
            type: MOVE,
            payload: {
              move: {
                from: selectedSquare,
                to: squareCoord,
                // Handle promotion (this is simplified - you may want to add a promotion UI)
                promotion: isPawnPromotion(selectedSquare, squareCoord)
                  ? "q"
                  : undefined,
              },
            },
          }),
        );

        // Update local board state
        try {
          chess.move({
            from: selectedSquare,
            to: squareCoord,
            promotion: isPawnPromotion(selectedSquare, squareCoord)
              ? "q"
              : undefined,
          });

          // Store the last move for highlighting
          setLastMove({
            from: selectedSquare,
            to: squareCoord,
          });

          setBoard(chess.board());
        } catch (error) {
          console.error("Invalid move:", error);
        }

        // Reset selection
        setSelectedSquare(null);
      }
      // If clicking another piece of the same color, select that piece instead
      else {
        const piece = chess.get(squareCoord);
        if (piece && piece.color === (chess.turn() === "w" ? "w" : "b")) {
          setSelectedSquare(squareCoord);
        }
      }
    }
  };

  // Helper to check if a move is a pawn promotion
  const isPawnPromotion = (from: Square, to: Square): boolean => {
    const piece = chess.get(from);
    if (!piece) return false;

    return (
      piece.type === "p" &&
      ((piece.color === "w" && to[1] === "8") ||
        (piece.color === "b" && to[1] === "1"))
    );
  };

  // Determine square color, including highlighting
  const getSquareClass = (coord: Square, i: number, j: number): string => {
    const baseColor = (i + j) % 2 === 0 ? "bg-[#769656]" : "bg-[#eeeed2]";

    // Highlight selected square
    if (selectedSquare === coord) {
      return `${baseColor} ring-2 ring-yellow-400`;
    }

    // Highlight possible moves
    if (selectedSquare && possibleMoves.includes(coord)) {
      return `${baseColor} ring-2 ring-yellow-300 ring-opacity-70`;
    }

    // Highlight last move
    if (lastMove && (lastMove.from === coord || lastMove.to === coord)) {
      return `${baseColor} bg-opacity-70 ring-1 ring-blue-400`;
    }

    return baseColor;
  };

  // Get piece image path
  const getPieceImagePath = (piece: { type: PieceSymbol; color: Color }) => {
    if (piece.color === "w") {
      // White pieces - uppercase with "copy" suffix
      return `/${piece.type.toUpperCase()} copy.png`;
    } else {
      // Black pieces - lowercase
      return `/${piece.type}.png`;
    }
  };

  return (
    <div className="chess-board border-2 border-gray-700 shadow-lg">
      {/* Board */}
      <div className="text-white-200">
        {board.map((row, i) => (
          <div key={i} className="flex">
            {row.map((square, j) => {
              const squareCoord = (String.fromCharCode(97 + (j % 8)) +
                "" +
                (8 - i)) as Square;

              return (
                <div
                  key={j}
                  onClick={() => handleSquareClick(squareCoord)}
                  className={`w-16 h-16 md:w-20 md:h-20 relative ${getSquareClass(squareCoord, i, j)}`}
                >
                  {/* Square coordinates (only on edge squares) */}
                  {i === 7 && (
                    <div className="absolute bottom-0.5 right-1 text-xs opacity-70">
                      {squareCoord[0]}
                    </div>
                  )}
                  {j === 0 && (
                    <div className="absolute top-0.5 left-1 text-xs opacity-70">
                      {squareCoord[1]}
                    </div>
                  )}

                  {/* Piece */}
                  {square && (
                    <div className="w-full h-full flex items-center justify-center">
                      <img
                        className={`w-2/5 h-1/2 drop-shadow-xl ${selectedSquare === squareCoord ? "transform scale-110" : ""}`}
                        src={getPieceImagePath(square)}
                        alt={`${square.color}${square.type}`}
                      />
                    </div>
                  )}

                  {/* Highlight for possible moves on empty squares */}
                  {!square &&
                    selectedSquare &&
                    possibleMoves.includes(squareCoord) && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-yellow-300 opacity-50"></div>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
