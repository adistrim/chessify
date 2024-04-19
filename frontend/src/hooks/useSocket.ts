import { useEffect, useState } from "react"

const WS_URL: string = import.meta.env.VITE_WS_URL as string;

export const useSocket = () => {
    const [socket, setSocket] = useState<WebSocket | null>(null)

    useEffect(() => {
        const ws = new WebSocket(WS_URL)
        ws.onopen = () => {
            setSocket(ws)
        }
        ws.onclose = () => {
            setSocket(null)
        }
        setSocket(ws)
        return () => {
            ws.close()
        }
    }, [])

    return socket;
}