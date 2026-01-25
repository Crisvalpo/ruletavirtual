import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useVenueSettings() {
    const [venueMode, setVenueMode] = useState<'individual' | 'group_event'>('individual');
    const [centralScreenId, setCentralScreenId] = useState<number>(1);
    const supabase = createClient();

    useEffect(() => {
        // Initial fetch
        supabase.from('venue_settings').select('*').single().then(({ data }) => {
            if (data) {
                setVenueMode(data.current_mode);
                setCentralScreenId(data.central_screen_id);
            }
        });

        // Subscribe
        const channel = supabase
            .channel('venue_settings_global')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'venue_settings' },
                (payload) => {
                    setVenueMode(payload.new.current_mode);
                    setCentralScreenId(payload.new.central_screen_id);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [supabase]);

    return { venueMode, centralScreenId };
}
