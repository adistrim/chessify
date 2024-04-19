import React from "react"



export const Button = ({onClick, children}: {onClick: () => void, children: React.ReactNode}) => {
    return (
        <button onClick={onClick} className="bg-[#769656] text-white font-bold py-3 px-6 rounded">
            {children}
        </button>
    )
}
