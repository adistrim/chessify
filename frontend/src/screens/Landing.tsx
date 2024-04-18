import { useNavigate } from "react-router-dom";


export const Landing = () => {

    const navigate = useNavigate();

    return (
        <div className="bg-gray-900 min-h-screen flex items-center justify-center">
            <div className="max-w-4xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="text-center md:text-left">
                        <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
                            Welcome to Chessify
                        </h1>
                        <p className="text-lg md:text-xl text-gray-400 mb-6">
                            Play Chess with anyone while staying anonymous
                        </p>
                        <div className="flex justify-center md:justify-start">
                            <button onClick={() => {
                                navigate('/game')
                            }} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-opacity-50">
                                Play Now
                            </button>
                        </div>
                    </div>
                    <div className="flex justify-center">
                        <img src="/chess-board.jpg" alt="Chess Board" className="max-w-full md:max-w-lg rounded-lg shadow-lg" />
                    </div>
                </div>
            </div>
        </div>
    );
};
