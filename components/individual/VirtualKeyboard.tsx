'use client';

import React from 'react';

interface VirtualKeyboardProps {
    onKeyPress: (key: string) => void;
    onDelete: () => void;
    onClear: () => void;
    onClose: () => void;
    onConfirm: () => void;
    value: string; // This should be the raw 5-char value (e.g. "AA027")
    errorMessage?: string;
    isLoading?: boolean;
}

export default function VirtualKeyboard({
    onKeyPress,
    onDelete,
    onClear,
    onClose,
    onConfirm,
    value,
    errorMessage,
    isLoading
}: VirtualKeyboardProps) {
    // Format: XX-NNN (2 letters + 3 numbers)
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

    const handleKeyClick = (key: string) => {
        if (value.length < 5) {
            onKeyPress(key);
        }
    };

    // Helper to display with hyphen
    const getDisplayChars = () => {
        const chars = value.split('');
        const display = [];
        for (let i = 0; i < 5; i++) {
            display.push(chars[i] || null);
        }
        return display;
    };

    const displayChars = getDisplayChars();

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex flex-col items-center justify-end animate-in fade-in duration-300">
            {/* Display Area */}
            <div className="w-full max-w-md p-6 flex flex-col items-center justify-center flex-1">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 text-white/40 hover:text-white p-2"
                >
                    <span className="text-3xl">✕</span>
                </button>

                <h2 className="text-yellow-500 uppercase tracking-[0.3em] text-xs font-black mb-8">
                    Ingresa Código de Ticket
                </h2>

                <div className="flex items-center gap-2 mb-4">
                    {/* First 2 Letters */}
                    {displayChars.slice(0, 2).map((char, i) => (
                        <div
                            key={`char-${i}`}
                            className={`
                                w-14 h-18 rounded-2xl border-2 flex items-center justify-center text-4xl font-black
                                transition-all duration-200
                                ${char
                                    ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10 scale-105 shadow-[0_0_15px_rgba(234,179,8,0.2)]'
                                    : 'border-white/10 text-white/5 bg-white/5'}
                                ${i === value.length ? 'border-yellow-500/50 animate-pulse' : ''}
                            `}
                        >
                            {char}
                        </div>
                    ))}

                    {/* Auto-Hyphen */}
                    <div className={`text-4xl font-black mx-1 ${value.length >= 2 ? 'text-yellow-500' : 'text-white/10'}`}>
                        -
                    </div>

                    {/* 3 Numbers */}
                    {displayChars.slice(2, 5).map((char, i) => (
                        <div
                            key={`num-${i}`}
                            className={`
                                w-14 h-18 rounded-2xl border-2 flex items-center justify-center text-4xl font-black
                                transition-all duration-200
                                ${char
                                    ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10 scale-105 shadow-[0_0_15px_rgba(234,179,8,0.2)]'
                                    : 'border-white/10 text-white/5 bg-white/5'}
                                ${i + 2 === value.length ? 'border-yellow-500/50 animate-pulse' : ''}
                            `}
                        >
                            {char}
                        </div>
                    ))}
                </div>
            </div>

            {/* Keyboard Grid */}
            <div className="w-full bg-[#0a0a0a] border-t border-white/10 p-4 pb-10 rounded-t-[3rem] shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">
                <div className="max-w-md mx-auto">

                    {/* Error Message Pinched between Display and Keyboard */}
                    {errorMessage && (
                        <div className="mb-6 animate-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-2xl flex items-center gap-3">
                                <span className="text-xl">⚠️</span>
                                <p className="text-red-400 text-[10px] font-black uppercase tracking-wider leading-tight">
                                    {errorMessage}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Letters Row (Step 1) */}
                    <div className="mb-6">
                        <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-3 text-center">Letras</p>
                        <div className="grid grid-cols-6 gap-2">
                            {letters.map((key) => (
                                <button
                                    key={key}
                                    onClick={() => handleKeyClick(key)}
                                    disabled={value.length >= 2}
                                    className={`
                                        h-14 rounded-xl text-xl font-black transition-all active:scale-90
                                        ${value.length < 2
                                            ? 'bg-white/10 text-white hover:bg-white/20'
                                            : 'bg-white/5 text-white/10 grayscale'}
                                    `}
                                >
                                    {key}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Numbers Grid (Step 2) */}
                    <div className="mb-6">
                        <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-3 text-center">Números</p>
                        <div className="grid grid-cols-5 gap-2">
                            {numbers.map((key) => (
                                <button
                                    key={key}
                                    onClick={() => handleKeyClick(key)}
                                    disabled={value.length < 2 || value.length >= 5}
                                    className={`
                                        h-14 rounded-xl text-xl font-black transition-all active:scale-90
                                        ${(value.length >= 2 && value.length < 5)
                                            ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]'
                                            : 'bg-white/5 text-white/10 grayscale'}
                                    `}
                                >
                                    {key}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="grid grid-cols-4 gap-3">
                        <button
                            onClick={onDelete}
                            className="h-16 rounded-2xl bg-white/5 text-white flex items-center justify-center text-2xl hover:bg-white/10 active:scale-90"
                        >
                            ⌫
                        </button>
                        <button
                            onClick={onClear}
                            className="h-16 rounded-2xl bg-white/5 text-white font-bold text-xs uppercase tracking-widest hover:bg-white/10 active:scale-90"
                        >
                            Limpiar
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={value.length < 5 || isLoading}
                            className="col-span-2 h-16 rounded-2xl bg-yellow-500 text-black font-black text-xl uppercase tracking-widest disabled:opacity-50 disabled:grayscale transition-all active:scale-95 shadow-[0_0_30px_rgba(234,179,8,0.3)] flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-4 border-black/20 border-t-black rounded-full animate-spin" />
                                    <span>...</span>
                                </>
                            ) : (
                                'Canjear'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
