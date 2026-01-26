'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

interface QueueItem {
    id: string;
    player_name: string;
    player_emoji: string;
    created_at: string;
}

export default function QueueList({ screenId }: { screenId: number }) {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const supabase = createClient();

    useEffect(() => {
        const fetchQueue = async () => {
            const { data } = await supabase
                .from('player_queue')
                .select('id, player_name, player_emoji, created_at')
                .eq('screen_number', screenId)
                .eq('status', 'waiting')
                .order('created_at', { ascending: true }); // Oldest first (FIFO)

            if (data) {
                setQueue(data);
            }
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
                    // Removing filter to debug potential filter issues. 
                    // We will fetch regardless, or could filter client side.
                    // Given low volume, checking all queue updates is fine for stability.
                },
                (payload) => {
                    // Refresh on any change (New player, status update, etc)
                    // Optional: Check if payload.new.screen_number == screenId (if available in payload)
                    // For INSERT, payload.new has the data.
                    const newItem = payload.new as any;
                    const oldItem = payload.old as any;

                    // Simple optimization: only refetch if related to this screen
                    if (newItem?.screen_number === screenId || oldItem?.screen_number === screenId) {
                        console.log("🔄 Queue Update detected! Refreshing list...", payload);
                        fetchQueue();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [screenId, supabase]);

    if (queue.length === 0) return null;

    return (
        <div className="animate-in fade-in duration-500">
            <div className="bg-black/30 backdrop-blur-md rounded-lg p-3 border border-white/10 shadow-lg">
                <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                    En Fila ({queue.length})
                </h3>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto no-scrollbar">
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
