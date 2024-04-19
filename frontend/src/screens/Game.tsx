import { useEffect, useState } from "react";
import { Button } from "../components/Button"
import { ChessBoard } from "../components/ChessBoard"
import { useSocket } from "../hooks/useSocket"
import { Chess } from "chess.js";


export const INIT_GAME = "init_game";
export const MOVE = "move";
export const GAME_OVER = "game_over";


export const Game = () => {

    const socket = useSocket();
    const [chess] = useState(new Chess())
    const [board, setBoard] = useState(chess.board());
    const [started, setStarted] = useState(false);

    useEffect(() => {
        if (!socket) {
            return
        }

        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            switch (message.type) {
                case INIT_GAME:
                    // setChess(new Chess()); // just reminding myself how big of a mistake this was
                    setBoard(chess.board());
                    setStarted(true);
                    break;
                case MOVE:
                    const move = message.payload;
                    chess.move(move);
                    setBoard(chess.board());
                    break;
                case GAME_OVER:
                    break;
            }
        }

        return () => {
            socket.onmessage = null;
        }
    }, [chess, socket]);

    if (!socket) {
        return <div className="flex justify-center">
            <h1 className="text-4xl">Connecting...</h1>
            </div>
    }


    return (
        <div className="flex justify-center">
            <div className="pt-8 max-w-screen-lg w-full">
                <div className="grid grid-cols-8 gap-4 w-full">
                    <div className="col-span-6 w-full flex justify-center">
                        <ChessBoard chess={chess} setBoard={setBoard} socket={socket} board={board} />
                    </div>
                    <div className="col-span-2 bg-[#eeeed2] w-full flex justify-center">
                        <div className="pt-8">
                        {!started && <Button onClick={() => {
                            socket.send(JSON.stringify({
                                type: INIT_GAME,
                            }))
                        }} >
                            Ready
                        </Button>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
