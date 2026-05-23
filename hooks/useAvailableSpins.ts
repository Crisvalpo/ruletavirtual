'use client';

import { useAuth } from '@/hooks/useAuth';
import { getDeviceFingerprint } from '@/lib/deviceFingerprint';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useCallback } from 'react';

export interface AvailablePackage {
    code: string;
    remainingSpins: number;
    source: 'device' | 'email';
    packageId?: string;
}

export function useAvailableSpins() {
    const { user, isLoading: authLoading } = useAuth();
    const [totalSpinsAvailable, setTotalSpinsAvailable] = useState(0);
    const [availablePackages, setAvailablePackages] = useState<AvailablePackage[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const fetchSpins = useCallback(async () => {
        if (authLoading) return;
        setLoading(true);

        try {
            const fingerprint = getDeviceFingerprint();
            
            // 1. Fetch package_tracking for this device
            const { data: devicePackages, error: devErr } = await supabase
                .from('package_tracking')
                .select('*')
                .eq('device_fingerprint', fingerprint);

            if (devErr) {
                console.error('Error fetching device packages:', devErr);
            }

            // 2. Fetch game_packages for this email (if logged in)
            let emailPackages: any[] = [];
            if (user?.email) {
                const { data: pkgData, error: pkgErr } = await supabase
                    .from('game_packages')
                    .select('*')
                    .eq('buyer_email', user.email)
                    .eq('is_active', true)
                    .gt('valid_until', new Date().toISOString());

                if (pkgErr) {
                    console.error('Error fetching email packages:', pkgErr);
                } else if (pkgData) {
                    emailPackages = pkgData;
                }
            }

            // 3. Fetch package_tracking status for these email packages to see if they're redeemed elsewhere
            let trackedPackages: any[] = [];
            if (emailPackages.length > 0) {
                const codes = emailPackages.map(p => p.code);
                const { data: trackData, error: trackErr } = await supabase
                    .from('package_tracking')
                    .select('*')
                    .in('package_code', codes);

                if (trackErr) {
                    console.error('Error fetching tracked packages for email packages:', trackErr);
                } else if (trackData) {
                    trackedPackages = trackData;
                }
            }

            // 4. Consolidate and deduplicate packages by code
            const consolidated: Map<string, AvailablePackage> = new Map();

            // First, add all packages that are already redeemed on this device and have spins left
            if (devicePackages) {
                devicePackages.forEach(dp => {
                    const remaining = dp.total_spins - dp.spins_consumed;
                    if (remaining > 0) {
                        consolidated.set(dp.package_code, {
                            code: dp.package_code,
                            remainingSpins: remaining,
                            source: 'device',
                            packageId: dp.id
                        });
                    }
                });
            }

            // Second, add email packages if they haven't been locked to another device
            emailPackages.forEach(ep => {
                const tracked = trackedPackages.find(tp => tp.package_code === ep.code);
                if (!tracked) {
                    // Not redeemed anywhere yet, it's fully available
                    if (ep.plays_remaining > 0) {
                        consolidated.set(ep.code, {
                            code: ep.code,
                            remainingSpins: ep.plays_remaining,
                            source: 'email'
                        });
                    }
                } else {
                    // Already redeemed. Check if it belongs to this device
                    if (tracked.device_fingerprint === fingerprint) {
                        const remaining = tracked.total_spins - tracked.spins_consumed;
                        if (remaining > 0 && !consolidated.has(ep.code)) {
                            consolidated.set(ep.code, {
                                code: ep.code,
                                remainingSpins: remaining,
                                source: 'device',
                                packageId: tracked.id
                            });
                        }
                    } else {
                        // Redeemed on a different device - not available on this device!
                    }
                }
            });

            const list = Array.from(consolidated.values());
            const total = list.reduce((sum, item) => sum + item.remainingSpins, 0);

            setAvailablePackages(list);
            setTotalSpinsAvailable(total);
        } catch (err) {
            console.error('Error in useAvailableSpins:', err);
        } finally {
            setLoading(false);
        }
    }, [user, authLoading, supabase]);

    useEffect(() => {
        fetchSpins();
    }, [fetchSpins]);

    return {
        totalSpinsAvailable,
        availablePackages,
        loading,
        refreshSpins: fetchSpins
    };
}
