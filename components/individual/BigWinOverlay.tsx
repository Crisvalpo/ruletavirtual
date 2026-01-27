import React from 'react';
import Image from 'next/image';

interface BigWinOverlayProps {
    isVisible: boolean;
    resultIndex: number | null;
    assets: { background: string; segments: any[] } | null;
    playerName?: string | null;
    type?: 'win' | 'loss';
}

export default function BigWinOverlay({ isVisible, resultIndex, assets, playerName, type = 'win' }: BigWinOverlayProps) {
    if (!isVisible || resultIndex === null) return null;

    // Find the winning segment image/label
    let winnerImage = null;
    let winnerLabel = `#${resultIndex}`;

    if (assets?.segments) {
        const segment = assets.segments.find((s: any) => s.id === resultIndex);
        if (segment) {
            winnerImage = segment.imageResult || segment.imageWheel;
            winnerLabel = segment.label || winnerLabel;
        }
    }

    // Use player name if available, otherwise fallback to winnerLabel
    const displayLabel = playerName || winnerLabel;

    // Loss Configuration
    const isLoss = type === 'loss';
    const title = isLoss ? '¡Sigue Intentando!' : '¡Ganador!';
    const borderColor = isLoss ? 'border-blue-400' : 'border-yellow-400';
    const glowColor = isLoss ? 'bg-blue-500/50' : 'bg-yellow-500/50';
    const shadowColor = isLoss ? 'shadow-[0_0_100px_rgba(59,130,246,0.5)]' : 'shadow-[0_0_100px_rgba(250,204,21,0.5)]';
    const titleColor = isLoss ? 'text-blue-400' : 'text-yellow-400';

    return (
        <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/90 backdrop-blur-md transition-opacity duration-500">
            <div className="relative animate-zoom-in flex flex-col items-center scale-125">

                {/* Glow Effect */}
                <div className={`absolute inset-0 ${glowColor} blur-[120px] rounded-full scale-150 animate-pulse opacity-50`}></div>

                {/* Main Card */}
                <div className={`bg-black/80 backdrop-blur-xl p-12 rounded-[3rem] border-4 ${borderColor} ${shadowColor} flex flex-col items-center text-center transform hover:scale-105 transition-transform duration-500 relative overflow-hidden min-w-[500px]`}>

                    {/* Shimmer Effect (Only for Win?) Let's keep for both for premium look */}
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>

                    <h2 className={`text-5xl md:text-6xl font-bold ${titleColor} mb-6 drop-shadow-lg tracking-wider uppercase whitespace-nowrap`}>
                        {title}
                    </h2>

                    <div className="w-64 h-64 relative mb-6 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center p-4">
                        {winnerImage ? (
                            <Image
                                src={winnerImage}
                                alt="Result"
                                fill
                                className="object-contain drop-shadow-2xl"
                            />
                        ) : (
                            <span className="text-8xl font-bold text-white">{resultIndex}</span>
                        )}
                    </div>

                    <div className="text-3xl text-white font-bold tracking-wide">
                        {displayLabel}
                    </div>

                    {isLoss && (
                        <p className="text-white/60 mt-4 text-sm uppercase tracking-widest animate-pulse">
                            ¡La próxima es la vencida!
                        </p>
                    )}

                </div>
            </div>
        </div>
    );
}
