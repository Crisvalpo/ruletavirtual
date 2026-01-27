'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ANIMAL_LIST } from '@/lib/constants/animals';

interface QueueItem {
    id: string;
    player_name: string;
    player_emoji: string;
    created_at: string;
    status: string;
    selected_animals?: number[];
}

export default function QueueList({ screenId, assets }: { screenId: number; assets: any }) {
    const [queue, setQueue] = useState<QueueItem[]>([]); // Waiting
    const [activeSelectors, setActiveSelectors] = useState<QueueItem[]>([]); // Selecting
    const supabase = createClient();

    useEffect(() => {
        const fetchQueue = async () => {
            // Fetch Waiting
            const { data: waitingData } = await supabase
                .from('player_queue')
                .select('id, player_name, player_emoji, created_at, status')
                .eq('screen_number', screenId)
                .eq('status', 'waiting')
                .order('created_at', { ascending: true });

            if (waitingData) setQueue(waitingData);

            // Fetch Selecting (Live)
            const { data: selectingData } = await supabase
                .from('player_queue')
                .select('id, player_name, player_emoji, created_at, status, selected_animals')
                .eq('screen_number', screenId)
                .eq('status', 'selecting')
                .order('created_at', { ascending: true });

            if (selectingData) setActiveSelectors(selectingData);
        };

        // Initial fetch
        fetchQueue();

        // Realtime Subscription
        const channel = supabase
            .channel(`queue_display_${screenId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'player_queue',
                },
                (payload) => {
                    const newItem = payload.new as any;
                    const oldItem = payload.old as any;
                    if (newItem?.screen_number === screenId || oldItem?.screen_number === screenId) {
                        fetchQueue();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [screenId, supabase]);

    if (queue.length === 0 && activeSelectors.length === 0) return null;

    return (
        <div className="animate-in fade-in duration-500">
            <div className="bg-black/30 backdrop-blur-md rounded-lg p-3 border border-white/10 shadow-lg">
                <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                    En Fila ({queue.length})
                </h3>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto no-scrollbar">
                    {/* 1. Show Active Selectors (First in line effectively) */}
                    {activeSelectors.map((player) => (
                        <div key={player.id} className="flex flex-col gap-1 border-b border-white/10 pb-2 mb-1">
                            <div className="flex items-center gap-2 text-yellow-400/90 animate-pulse">
                                <span className="text-sm font-bold truncate max-w-[120px]">
                                    {player.player_emoji} {player.player_name}
                                </span>
                                <span className="text-[10px] uppercase bg-yellow-500/20 px-1.5 py-0.5 rounded text-yellow-300">
                                    Eligiendo...
                                </span>
                            </div>
                            {/* Live Selection Preview */}
                            <div className="flex gap-1 pl-4">
                                {player.selected_animals && Array.isArray(player.selected_animals) ? (
                                    player.selected_animals.map((idx, i) => {
                                        let imgSrc: string | null = null;

                                        if (assets?.segments) {
                                            const seg = assets.segments.find((s: any) => s.id === idx);
                                            // PRIORITIZE SELECTOR IMAGE (Square/Icon) over Wheel Image (Wedge)
                                            if (seg) imgSrc = seg.imageResult || seg.imageWheel;
                                        }

                                        if (!imgSrc) {
                                            const animal = ANIMAL_LIST.find(a => a.id === idx);
                                            if (animal) imgSrc = animal.imageSelector || animal.imageWheel;
                                        }

                                        return (
                                            <div key={i} className="relative w-8 h-8 rounded-full bg-white/10 border border-white/20 overflow-hidden shadow-md">
                                                {imgSrc ? (
                                                    <Image src={imgSrc} alt={`${idx}`} fill className="object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold">
                                                        {idx}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <span className="text-[10px] text-gray-500 italic ml-1">...</span>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* 2. Show Waiting Queue */}
                    {queue.map((player, index) => (
                        <div key={player.id} className="flex items-center gap-2 text-white/80">
                            <span className="text-xs font-mono opacity-50 w-4">
                                {String(index + 1).padStart(2, '0')}
                            </span>
                            <span className="text-sm italic font-medium truncate max-w-[120px]">
                                {player.player_emoji} {player.player_name}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
