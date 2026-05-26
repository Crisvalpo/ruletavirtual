import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useVenueSettings() {
    const [venueMode, setVenueMode] = useState<'individual' | 'group_event' | null>(null);
    const [centralScreenId, setCentralScreenId] = useState<number>(1);
    const [baseUrl, setBaseUrl] = useState<string | null>(null);
    const [activeRaffleId, setActiveRaffleId] = useState<string | null>(null);
    const [raffleBillboardId, setRaffleBillboardId] = useState<number>(4);
    const supabase = createClient();

    useEffect(() => {
        // Initial fetch
        supabase.from('venue_settings').select('*').single().then(({ data }) => {
            if (data) {
                setVenueMode(data.current_mode);
                setCentralScreenId(data.central_screen_id);
                setBaseUrl(data.base_url);
                setActiveRaffleId(data.active_raffle_id);
                setRaffleBillboardId(data.raffle_billboard_screen_id || 4);
            }
        });

        // Subscribe
        const channel = supabase
            .channel('venue_settings_global')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'venue_settings' },
                (payload) => {
                    setVenueMode(payload.new.current_mode);
                    setCentralScreenId(payload.new.central_screen_id);
                    setBaseUrl(payload.new.base_url);
                    setActiveRaffleId(payload.new.active_raffle_id);
                    setRaffleBillboardId(payload.new.raffle_billboard_screen_id || 4);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [supabase]);

    return { venueMode, centralScreenId, baseUrl, activeRaffleId, raffleBillboardId };
}
