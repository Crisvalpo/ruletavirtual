'use client';

import { use, useEffect, useState, useRef } from 'react';
import WheelCanvas from '@/components/individual/WheelCanvas';
import { ANIMAL_LIST } from '@/lib/constants/animals';
import Image from 'next/image';
import BigWinOverlay from '@/components/individual/BigWinOverlay';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeGame } from '@/hooks/useRealtimeGame';
import { useVenueSettings } from '@/hooks/useVenueSettings';
import { useGameStore } from '@/lib/store/gameStore';
import Confetti from 'react-confetti';
import QueueList from '@/components/individual/QueueList';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
// Remove useWindowSize if not strictly needed or ensure package is present.
// The code used window.innerWidth directly inside the check, which is fine.

export default function DisplayScreenPage({
    params
}: {
    params: Promise<{ screen: string }>
}) {
    const { screen } = use(params);
    const screenIdNum = parseInt(screen);

    // 0. Auth & Admin Security Check
    const { user, profile, isLoading } = useAuth();
    const router = useRouter();
    const isAdmin = profile?.role === 'admin' || user?.email === 'cristianluke@gmail.com' || user?.email === 'tortolasluke@gmail.com';

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.push(`/auth/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
            } else if (!isAdmin) {
                router.push('/not-authorized');
            }
        }
    }, [user, isAdmin, isLoading, router]);

    // 1. Hooks
    useRealtimeGame(screen);
    const { venueMode, centralScreenId, baseUrl } = useVenueSettings();

    // 2. Read from store (Individual Mode State)
    const mode = useGameStore((state) => state.gameMode);
    const activeWheelId = useGameStore((state) => state.activeWheelId);
    const realNickname = useGameStore(state => state.nickname); // Moved up for access
    const realEmoji = useGameStore(state => state.emoji); // Moved up
    const currentQueueId = useGameStore(state => state.currentQueueId);

    // 3. Logic: Determine effective mode
    const isGroupEvent = venueMode === 'group_event';
    const isCentralScreen = isGroupEvent && screenIdNum === centralScreenId;
    const isBillboardScreen = isGroupEvent && !isCentralScreen;

    useEffect(() => {
        console.log(`📡 [Mode Sync] venueMode: ${venueMode}, storeMode: ${mode}, isGroupEvent: ${isGroupEvent}`);
    }, [venueMode, mode, isGroupEvent]);

    // Effective Wheel ID for Individual Play (ignored if Group Event)
    const MARIO_WHEEL_ID = 'a4b68bf3-78e6-4a16-9957-5d357dbd1d8a';

    // CRITICAL: If venueMode is individual, we MUST use the activeWheelId from store (synced via current_wheel_id)
    // or fallback to Mario. If it's group_event, we use null (for 36 animals).
    const effectiveActiveWheelId = isGroupEvent ? null : (activeWheelId || MARIO_WHEEL_ID);
    const effectiveMode = isGroupEvent ? 'group' : 'individual';

    // Celebration State
    const [status, setStatus] = useState<'idle' | 'spinning' | 'result'>('idle');
    const [isDuplicateScreen, setIsDuplicateScreen] = useState(false);
    const [isLocalDuplicate, setIsLocalDuplicate] = useState(false);
    const [result, setResult] = useState<number | null>(null);
    // History State
    const [lastSpins, setLastSpins] = useState<any[]>([]);
    // Client-side URL (to avoid SSR window error)
    const [clientUrl, setClientUrl] = useState<string>('');

    useEffect(() => {
        setClientUrl(window.location.origin);
    }, []);

    // Missing State Definitions
    const [activeWheelAssets, setActiveWheelAssets] = useState<any>(null);
    const [assetsLoading, setAssetsLoading] = useState<boolean>(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [showBigWin, setShowBigWin] = useState(false);
    const [currentSelections, setCurrentSelections] = useState<number[]>([]);
    const supabase = createClient();
    const instanceId = useRef(Math.random().toString(36).substring(7));
    const joinedAt = useRef(Date.now());

    // 2.5 Supabase Presence: Prevent Duplicate Screens (First One Wins)
    useEffect(() => {
        if (!screenIdNum || isLoading || !user || !isAdmin) return;

        const channel = supabase.channel('global_presence_monitor');

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();

                // Find all display instances for THIS screen
                const otherInstances: any[] = [];
                Object.values(state).forEach((presences: any) => {
                    presences.forEach((p: any) => {
                        if (p.type === 'display' && p.screen === screenIdNum) {
                            otherInstances.push(p);
                        }
                    });
                });

                // NO DUPLICATE DETECTED?
                if (otherInstances.length <= 1) {
                    setIsDuplicateScreen(false);
                    return;
                }

                // ARBITRATION: First one to join wins.
                // Sort by timestamp. 
                otherInstances.sort((a, b) => a.joined_at - b.joined_at);

                // If the first instance ID is NOT ours, then we are a duplicate.
                const firstInstance = otherInstances[0];
                if (firstInstance.id !== instanceId.current) {
                    console.warn(`🚫 OTRA PESTAÑA DETECTADA (ID: ${instanceId.current}): Bloqueando esta instancia secundaria.`);
                    setIsDuplicateScreen(true);
                } else {
                    setIsDuplicateScreen(false);
                }
            })
            .subscribe(async (subStatus) => {
                if (subStatus === 'SUBSCRIBED') {
                    await channel.track({
                        id: instanceId.current,
                        screen: screenIdNum,
                        type: 'display',
                        joined_at: joinedAt.current
                    });
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [screenIdNum, supabase]);

    // 2.6 Local BroadcastChannel: Prevent Duplicate Screens on Same Device
    useEffect(() => {
        if (!screenIdNum || typeof window === 'undefined') return;

        const channelName = `ruleta_screen_session_${screenIdNum}`;
        const bc = new BroadcastChannel(channelName);

        // Send ping to detect if there's already an active tab
        bc.postMessage({ type: 'ping', id: instanceId.current });

        const handleMessage = (event: MessageEvent) => {
            const data = event.data;
            if (!data) return;

            if (data.type === 'ping' && data.id !== instanceId.current) {
                // Another tab is pinging. We are active, so we respond with pong.
                bc.postMessage({ type: 'pong', id: instanceId.current });
            } else if (data.type === 'pong' && data.id !== instanceId.current) {
                // We received a pong from an already active tab. We must block ourselves.
                console.warn(`🚫 Local BroadcastChannel: duplicate tab detected for screen ${screenIdNum}`);
                setIsLocalDuplicate(true);
            }
        };

        bc.addEventListener('message', handleMessage);

        return () => {
            bc.removeEventListener('message', handleMessage);
            bc.close();
        };
    }, [screenIdNum]);

    // 2.7 Supabase Broadcast: Remote Reload
    useEffect(() => {
        if (!screenIdNum) return;

        const channel = supabase.channel(`screen_commands_${screenIdNum}`);
        channel
            .on('broadcast', { event: 'force_reload' }, () => {
                console.log('🔄 RECARGA REMOTA RECIBIDA: Reiniciando pantalla...');
                window.location.reload();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [screenIdNum, supabase]);

    // 3. Effect: When activeWheelId or Mode changes, fetch assets
    useEffect(() => {
        console.log(`🎨 [Assets] Status check:
            - venueMode: ${venueMode}
            - isGroupEvent: ${isGroupEvent}
            - storeMode: ${mode}
            - activeWheelId (store): ${activeWheelId}
            - effectiveActiveWheelId: ${effectiveActiveWheelId}
            - effectiveMode: ${effectiveMode}
        `);

        async function loadWheelAssets() {
            setAssetsLoading(true);
            const loadStartTime = Date.now();

            // FAILSAFE: Ensure we don't stay stuck in loading more than 10s
            const loadingFailsafe = setTimeout(() => {
                setAssetsLoading(prev => {
                    if (prev) {
                        console.warn(`⏳ [Assets] Failsafe triggered for Screen ${screenIdNum} after 10s`);
                        return false;
                    }
                    return prev;
                });
            }, 10000);

            try {
                // If in group event mode, we use the default 36 animals, so no specific wheel assets are needed.
                // effectiveActiveWheelId will be null in this case.
                if (venueMode === 'group_event') {
                    console.log("🎨 [Assets] Group Mode detected, clearing specific wheel assets (using default 36 animals)");
                    setActiveWheelAssets(null);
                    return;
                }

                // If not in group event mode, we must have an effectiveActiveWheelId.
                // If it's null here, it means individual mode but no wheel ID (shouldn't happen with MARIO_WHEEL_ID fallback).
                if (!effectiveActiveWheelId) {
                    console.warn("🎨 [Assets] Individual Mode but no effectiveActiveWheelId. This should not happen.");
                    setActiveWheelAssets(null);
                    return;
                }

                console.log(`🎨 [Assets] Fetching for ID: ${effectiveActiveWheelId}`);
                // ... fetch logic ...
                const FORCE_DEBUG = false; // Set to false to enable Real Database Fetching

                if (FORCE_DEBUG) {
                    // Base URL for Supabase Storage (Public Bucket: individual-wheels)
                    // Corrected path based on Storage structure: mario/mario/segments/X.png
                    // Project ID: umimqlybmqivowsshtkt
                    const STORAGE_BASE = `https://umimqlybmqivowsshtkt.supabase.co/storage/v1/object/public/individual-wheels`;

                    const segments = Array.from({ length: 12 }, (_, i) => ({
                        id: i + 1,
                        label: `Seg ${i + 1}`,
                        color: 'transparent',
                        imageWheel: `${STORAGE_BASE}/mario/segments/${i + 1}.png`,
                        imageResult: `${STORAGE_BASE}/mario/selector/${i + 1}.jpg`
                    }));

                    setActiveWheelAssets({
                        background: `${STORAGE_BASE}/mario/background.jpg`,
                        segments: segments
                    });
                    return;
                } else {
                    // REAL LOGIC: Fetch Dynamic Wheel Data
                    try {
                        const { data: wheel, error: wheelError } = await supabase
                            .from('individual_wheels')
                            .select('storage_path, segment_count, background_image')
                            .eq('id', effectiveActiveWheelId)
                            .single();

                        if (wheelError) throw wheelError;

                        const { data: dbSegments, error: segmentError } = await supabase
                            .from('individual_wheel_segments')
                            .select('position, name, segment_image, selector_image, color')
                            .eq('wheel_id', effectiveActiveWheelId)
                            .order('position', { ascending: true });

                        if (segmentError) throw segmentError;

                        if (wheel) {
                            const STORAGE_BASE = `https://umimqlybmqivowsshtkt.supabase.co/storage/v1/object/public/individual-wheels`;

                            // Handle both relative and absolute paths
                            const getFullUrl = (path: string | null) => {
                                if (!path) return null;
                                return path.startsWith('http') ? path : `${STORAGE_BASE}/${path}`;
                            };

                            const segments = dbSegments.map(s => ({
                                id: s.position,
                                label: s.name,
                                color: s.color || 'transparent',
                                imageWheel: getFullUrl(s.segment_image),
                                imageResult: getFullUrl(s.selector_image)
                            }));

                            setActiveWheelAssets({
                                background: getFullUrl(wheel.background_image) || '',
                                segments: segments
                            });
                        }
                    } catch (err: any) {
                        console.error("❌ Failed to load wheel assets:", {
                            wheelId: effectiveActiveWheelId,
                            message: err.message || "Unknown error",
                            details: err.details,
                            code: err.code
                        });
                        console.log("⚠️ Falling back to Mario Wheel due to error");
                        // FORCE FALLBACK TO MARIO (Built-in)
                        const STORAGE_BASE = `https://umimqlybmqivowsshtkt.supabase.co/storage/v1/object/public/individual-wheels`;
                        const segments = Array.from({ length: 12 }, (_, i) => ({
                            id: i + 1,
                            label: `Seg ${i + 1}`,
                            color: 'transparent',
                            imageWheel: `${STORAGE_BASE}/mario/segments/${i + 1}.png`,
                            imageResult: `${STORAGE_BASE}/mario/selector/${i + 1}.jpg`
                        }));
                        setActiveWheelAssets({
                            background: `${STORAGE_BASE}/mario/background.jpg`,
                            segments: segments
                        });
                    }
                }
            } catch (err: any) {
                console.error("❌ Failed to load wheel assets:", err);
                setActiveWheelAssets(null); // Ensure assets are cleared on any top-level error
            } finally {
                clearTimeout(loadingFailsafe);
                setAssetsLoading(false);
                console.log(`🎨 [Assets] Load finished for Screen ${screenIdNum} in ${Date.now() - loadStartTime}ms`);
            }
        }
        loadWheelAssets();
    }, [venueMode, effectiveActiveWheelId]);

    // 4. Listen to Store Status (Triggered by Realtime from Mobile)
    const storeStatus = useGameStore(s => s.status);
    const idleSpeed = useGameStore(s => s.idleSpeed);

    useEffect(() => {
        // Start Spin
        // Start Spin
        if (storeStatus === 'spinning' && status === 'idle') {
            console.log('📱 Mobile Spin triggered - Server Authority Mode');
            setStatus('spinning');
            setResult(null); // Clear previous result locally

            // FETCH RESULT FROM DB (Source of Truth)
            // The result was generated by the RPC 'play_spin' instantenously.
            // FETCH RESULT LOGIC 2.0 (Store First)
            const storeResult = useGameStore.getState().lastSpinResult;

            if (storeResult !== null) {
                console.log("📥 Instant Result from Store:", storeResult);
                setResult(storeResult);
            } else {
                console.log("🔍 Store empty, fetching from DB for screen", screenIdNum);
                const fetchResult = async () => {
                    console.log("🔍 Fetching spin result for screen", screenIdNum);
                    const { data, error } = await supabase
                        .from('screen_state')
                        .select('last_spin_result')
                        .eq('screen_number', screenIdNum)
                        .single();

                    if (error) {
                        if (error.message?.includes('aborted') || error.code === 'ABORTED') return;
                        console.error("❌ Error fetching result:", {
                            code: error.code,
                            message: error.message,
                            screenId: screenIdNum
                        });
                    }

                    if (data && data.last_spin_result !== null) {
                        console.log("📥 Received Server Result:", data.last_spin_result);
                        setResult(data.last_spin_result); // Triggers animation
                    } else {
                        console.warn("⚠️ Spin triggered but no result in DB (or null). Waiting generic time...");

                        // WATCHDOG: Force a reset if no result arrives in 15 seconds
                        const watchdog = setTimeout(() => {
                            const currentStatus = useGameStore.getState().status;
                            if (currentStatus === 'spinning') {
                                console.error("🚨 TV WATCHDOG: Result timeout! Forcing fallback reset.");
                                setStatus('idle');
                            }
                        }, 15000);

                        // Retry once after 1s
                        setTimeout(async () => {
                            try {
                                const { data: retryData } = await supabase
                                    .from('screen_state')
                                    .select('last_spin_result')
                                    .eq('screen_number', screenIdNum)
                                    .single();

                                if (retryData && retryData.last_spin_result !== null) {
                                    console.log("📥 Retry Result Check Success:", retryData.last_spin_result);
                                    setResult(retryData.last_spin_result);
                                }
                            } catch (e) { }
                        }, 1000);

                        return () => clearTimeout(watchdog);
                    }
                };

                fetchResult();
            }

            // NO database updates here. The server already set everything.
        }
        // Reset / Cleanup (Driven by Realtime)
        else if (storeStatus === 'idle' && status !== 'idle') {
            console.log('🧹 Remote Reset triggered');
            setStatus('idle');
            setResult(null);
            setShowConfetti(false);
            setShowBigWin(false);
        }
    }, [storeStatus, status]);

    // State for Preview (Realtime Pre-selection)
    const [previewPlayer, setPreviewPlayer] = useState<{
        nickname: string;
        emoji: string;
        selections: number[];
    } | null>(null);

    // 6. Listener for Preview Broadcasts
    useEffect(() => {
        const channel = supabase.channel(`screen_${screenIdNum}`);

        channel.on(
            'broadcast',
            { event: 'preview_update' },
            (payload) => {
                console.log("👀 Preview Update:", payload.payload);
                setPreviewPlayer(payload.payload);

                // Auto-clear preview after 30s of inactivity
                const timer = setTimeout(() => {
                    setPreviewPlayer(null);
                }, 30000);
                return () => clearTimeout(timer);
            }
        ).subscribe();

        return () => {
            // Let useRealtimeGame handle channel cleanup or just remove listener
            // Actually better to keep separate if possible, but reusing channel name is fine
            // Supabase handles multiplexing.
        };
    }, [screenIdNum]);

    // Fetch Active Player Selections (OR USE PREVIEW)
    useEffect(() => {
        // Priority: 1. Active Playing (DB) 2. Preview (Broadcast)
        if (status === 'idle' && (!realNickname || realNickname === 'Jugador') && previewPlayer) {
            console.log("👀 Using Preview Selections");
            setCurrentSelections(previewPlayer.selections);
            return;
        }

        if (status === 'idle' && (!realNickname || realNickname === 'Jugador')) {
            console.log("🤷 No Active Player, clearing selections");
            setCurrentSelections([]);
            return;
        }

        if (isNaN(screenIdNum)) {
            console.error("❌ Invalid screenIdNum:", screen);
            return;
        }

        async function fetchSelections() {
            // Only fetch if we are NOT idle and have a real nickname
            if (status === 'idle') return;

            console.log("🔎 Fetching selections for Active Player:", realNickname, "on Screen:", screenIdNum);

            try {
                const { data, error } = await supabase
                    .from('player_queue')
                    .select('selected_animals')
                    .eq('screen_number', screenIdNum)
                    .eq('status', 'playing')
                    .maybeSingle();

                if (error) {
                    if (error.message?.includes('aborted') || error.code === 'ABORTED') return;
                    console.error("❌ Error fetching selections:", {
                        message: error.message,
                        details: error.details,
                        hint: error.hint,
                        code: error.code,
                        full: error
                    });
                    return;
                }

                if (data?.selected_animals) {
                    console.log("✅ Selections Found:", data.selected_animals);
                    setCurrentSelections(data.selected_animals as number[]);
                } else {
                    console.warn("⚠️ No selections found for active player in 'playing' status.");
                    setCurrentSelections([]);

                    // Optional Retry for lag
                    if (realNickname && realNickname !== 'Jugador') {
                        setTimeout(async () => {
                            const { data: retry } = await supabase
                                .from('player_queue')
                                .select('selected_animals')
                                .eq('screen_number', screenIdNum)
                                .eq('status', 'playing')
                                .maybeSingle();
                            if (retry?.selected_animals) {
                                console.log("✅ Retry Selections Found:", retry.selected_animals);
                                setCurrentSelections(retry.selected_animals as number[]);
                            }
                        }, 2000);
                    }
                }
            } catch (err: any) {
                console.error("❌ Exception in fetchSelections:", err);
            }
        }

        fetchSelections();
    }, [screenIdNum, status, realNickname, previewPlayer, screen]);

    // Fetch History Effect
    useEffect(() => {
        async function fetchHistory() {
            let query = supabase
                .from('game_history')
                .select('*')
                .eq('screen_id', screenIdNum)
                .order('created_at', { ascending: false })
                .limit(9);

            // Filter by Game/Wheel ID if active (prevents mixing Mario vs Sonic history)
            if (effectiveActiveWheelId) {
                query = query.eq('wheel_id', effectiveActiveWheelId);
            }

            const { data, error } = await query;

            if (data) {
                setLastSpins(data);
            }
        }
        fetchHistory();
    }, [screenIdNum, effectiveActiveWheelId]);

    const isDemo = useGameStore(state => state.isDemo);

    // State for Win/Loss
    const [isWin, setIsWin] = useState(false);

    // Handle Spin Complete
    const handleSpinComplete = async (winnerIndex: number) => {
        console.log(`🎰 Spin Complete! isDemo=${isDemo}, Index=${winnerIndex}`);

        // --- 0. IMMEDIATE VISUAL FEEDBACK (Non-blocking) ---
        setResult(winnerIndex);
        setStatus('result');
        setShowBigWin(true);

        // --- 0b. BROADCAST TO MOBILE (Instant Sync) ---
        supabase.channel(`screen_${screenIdNum}`).send({
            type: 'broadcast',
            event: 'spin_finished',
            payload: { result: winnerIndex }
        });

        // --- 1. Background Logic (Do not block visuals) ---
        (async () => {
            try {
                // 1a. Determine Win/Loss
                let playerWon = false;

                // Fetch current active player from queue safely
                const { data: activePlayer, error: fetchError } = await supabase
                    .from('player_queue')
                    .select('selected_animals')
                    .eq('screen_number', screenIdNum)
                    .eq('status', 'playing')
                    .maybeSingle();

                if (!fetchError && activePlayer && activePlayer.selected_animals) {
                    const selection = activePlayer.selected_animals as number[];
                    if (selection.includes(winnerIndex)) {
                        playerWon = true;
                    }
                } else if (isDemo) {
                    playerWon = true;
                }

                setIsWin(playerWon);

                // ✅ SOLO activar confetti si GANÓ
                if (playerWon) {
                    setShowConfetti(true);
                }

                // 1b. Update Screen State AND Complete Queue Item (Server Authority)
                // 1b. Update Screen State AND Complete Queue Item (Server Authority)
                // We use the existing RPC that handles package deduction + state update
                const { error: finishError } = await supabase.rpc('complete_spin_and_check_package', {
                    p_screen_number: screenIdNum,
                    p_result_index: winnerIndex
                });

                if (finishError) console.error("Error finishing spin cycle:", finishError);

                // 1d. Record History
                if (!isDemo) {
                    const historyEntry = {
                        screen_id: screenIdNum,
                        wheel_id: effectiveActiveWheelId || null,
                        result_index: winnerIndex,
                        player_name: realNickname || 'Anon',
                        created_at: new Date().toISOString()
                    };
                    await supabase.from('game_history').insert([historyEntry]); // Fire and forget
                    setLastSpins(prev => [historyEntry, ...prev].slice(0, 9));
                } else {
                    // Demo Cleanup
                    setTimeout(async () => {
                        console.log("🎓 Demo Finished. Passive Reset.");
                        await supabase
                            .from('screen_state')
                            .update({
                                status: 'idle',
                                player_id: null,
                                player_name: null,
                                player_emoji: null,
                                current_queue_id: null,
                                is_demo: false,
                                updated_at: new Date().toISOString()
                            })
                            .eq('screen_number', screenIdNum);
                    }, 5000);
                }

                // --- 2. FINAL CLEANUP (after result is shown for a while) ---
                if (!isDemo) {
                    setTimeout(async () => {
                        const { error } = await supabase.rpc('force_advance_queue', {
                            p_screen_number: screenIdNum,
                            p_expected_queue_id: currentQueueId
                        });
                        if (error) console.error('Error cleaning session:', error);
                    }, 10000);
                }

            } catch (err) {
                console.error("Critical error in spin complete logic:", err);
            }
        })();
    };

    // Move hooks to top level (Done)

    // Debug Spin Key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'q' || e.key === 'Q') {
                if (status === 'idle') {
                    console.log('🐞 Debug Spin triggered');
                    setStatus('spinning');
                    setResult(null);
                    // Simulate Result after 3s
                    setTimeout(() => {
                        const randomResult = Math.floor(Math.random() * 12) + 1;
                        setResult(randomResult);
                    }, 3000);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [status]);

    // 5. Watchdog: Auto-promote if idle or STUCK
    useEffect(() => {
        const checkPromotion = async () => {
            // Only check if we are truly idle in DB
            const { data: screenData } = await supabase
                .from('screen_state')
                .select('status, updated_at, current_queue_id')
                .eq('screen_number', screenIdNum)
                .single();

            if (screenData?.status === 'idle') {
                // Check if there is anyone waiting
                const { count } = await supabase
                    .from('player_queue')
                    .select('*', { count: 'exact', head: true })
                    .eq('screen_number', screenIdNum)
                    .eq('status', 'waiting');

                if (count && count > 0) {
                    console.log('🚀 TV Watchdog: Found players waiting! Promoting...');
                    await supabase.rpc('promote_next_player', {
                        p_screen_number: screenIdNum
                    });
                }
            }
            // NEW CASE: Stuck on waiting_for_spin (Player AWOL)
            else if (screenData?.status === 'waiting_for_spin') {
                const lastUpdate = new Date(screenData.updated_at).getTime();
                const now = new Date().getTime();
                const diffSeconds = (now - lastUpdate) / 1000;

                if (diffSeconds > 60) { // 60s timeout
                    console.warn('⚠️ TV Watchdog: Player inactive too long! Advancing...');
                    await supabase.rpc('force_advance_queue', {
                        p_screen_number: screenIdNum,
                        p_expected_queue_id: screenData.current_queue_id
                    });
                }
            }
            // NEW CASE: Stuck on selecting (Player AWOL during animal selection)
            else if (screenData?.status === 'selecting') {
                const lastUpdate = new Date(screenData.updated_at).getTime();
                const now = new Date().getTime();
                const diffSeconds = (now - lastUpdate) / 1000;

                if (diffSeconds > 120) { // 120s timeout
                    console.warn('⚠️ TV Watchdog: Player taking too long to select! Advancing...');
                    await supabase.rpc('force_advance_queue', {
                        p_screen_number: screenIdNum,
                        p_expected_queue_id: screenData.current_queue_id
                    });
                }
            }
        };

        const interval = setInterval(checkPromotion, 5000); // Check every 5s
        return () => clearInterval(interval);
    }, [screenIdNum, supabase]);

    // Derived Display Identity (Active or Preview)
    const displayNickname = (status === 'idle' && (!realNickname || realNickname === 'Jugador') && previewPlayer) ? previewPlayer.nickname : realNickname;
    const displayEmoji = (status === 'idle' && (!realNickname || realNickname === 'Jugador') && previewPlayer) ? previewPlayer.emoji : realEmoji;

    if (isLoading || !user || !isAdmin) {
        return (
            <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-8 text-center font-sans">
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
                <p className="text-slate-400 text-sm uppercase tracking-widest font-black">Verificando Credenciales de Administrador...</p>
            </div>
        );
    }

    const isBlocked = isDuplicateScreen || isLocalDuplicate;

    if (isBlocked) {
        return (
            <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 font-sans">
                <div className="w-24 h-24 bg-rose-500/20 rounded-full flex items-center justify-center text-5xl mb-6 border border-rose-500/30 animate-pulse text-rose-500">
                    ⚠️
                </div>
                <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">Pantalla Duplicada</h2>
                <p className="text-slate-400 max-w-md font-medium text-lg leading-relaxed">
                    Esta pantalla (<span className="text-rose-400">#{screenIdNum}</span>) ya se encuentra abierta en otra pestaña o dispositivo.
                </p>
                <div className="mt-8 flex flex-col gap-4 w-full max-w-xs transition-all">
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-white hover:bg-slate-100 text-slate-900 font-black py-4 rounded-2xl uppercase tracking-widest text-xs active:scale-95 shadow-xl transition-all"
                    >
                        🔄 Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-screen h-screen min-h-screen bg-gray-900 overflow-hidden relative font-sans">
            {/* Background (z-0) */}
            {!isBillboardScreen && (
                <div className="absolute inset-0 z-0">
                    {activeWheelAssets?.background && (
                        <Image
                            src={activeWheelAssets.background}
                            alt="Background"
                            fill
                            className="object-cover opacity-100"
                            priority
                        />
                    )}
                    <div className="absolute inset-0 bg-black/40" />
                </div>
            )}

            {/* CASO 1: MODO EVENTO - PANTALLA LATERAL (CARTELERA / ESTADÍSTICAS) */}
            {isBillboardScreen && (
                <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-start text-center p-0 overflow-hidden font-sans">
                    {/* Header Publicitario */}
                    <div className="w-full bg-indigo-600 py-8 shadow-2xl z-20">
                        <h1 className="text-6xl font-black text-white uppercase tracking-tighter animate-pulse">
                            🔥 ¡Gran Sorteo en Vivo! 🔥
                        </h1>
                        <p className="text-indigo-200 text-xl font-bold mt-2 uppercase tracking-widest">
                            Atentos a la Pantalla Principal
                        </p>
                    </div>

                    <div className="flex-1 w-full grid grid-cols-2 gap-8 p-12 bg-gradient-to-br from-slate-900 to-indigo-950">
                        {/* Estadísticas / Últimos Resultados */}
                        <div className="bg-white/5 backdrop-blur-xl rounded-[3rem] border border-white/10 p-10 flex flex-col shadow-inner">
                            <h3 className="text-3xl font-black text-indigo-400 mb-8 uppercase tracking-widest text-left flex items-center gap-4">
                                <span className="w-3 h-3 rounded-full bg-indigo-500 animate-ping" />
                                Últimos Ganadores
                            </h3>
                            <div className="space-y-4 flex-1">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="flex justify-between items-center bg-white/5 p-5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-2xl">🎟️</div>
                                            <span className="text-2xl font-black text-white uppercase">Ticket #{4592 - i * 4}</span>
                                        </div>
                                        <span className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">${(10000 * (6 - i)).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Espacio Publicitario / Promo */}
                        <div className="flex flex-col gap-8">
                            <div className="flex-1 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-[3rem] p-10 flex flex-col items-center justify-center text-white shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full -mr-32 -mt-32 blur-3xl transition-transform group-hover:scale-110" />
                                <span className="text-8xl mb-6 transform group-hover:scale-110 transition-transform">🍿</span>
                                <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none mb-4">¡Combo Ruleta!</h2>
                                <p className="text-2xl font-bold opacity-90 max-w-xs uppercase leading-tight">
                                    Pide tu combo y recibe <span className="text-yellow-300 font-black">2 TIROS GRATIS</span>
                                </p>
                            </div>
                            <div className="h-1/3 bg-white/5 backdrop-blur-md rounded-[3rem] border border-white/10 p-8 flex items-center justify-center gap-6">
                                <div className="text-left flex-1">
                                    <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-1">Próximo Sorteo</p>
                                    <p className="text-3xl font-black text-white uppercase italic">En Instantes</p>
                                </div>
                                <div className="w-20 h-20 rounded-full border-4 border-indigo-500/30 flex items-center justify-center text-2xl font-black text-indigo-400">
                                    VS
                                </div>
                                <div className="text-right flex-1">
                                    <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-1">Premio Mayor</p>
                                    <p className="text-3xl font-black text-emerald-400 uppercase italic">$1.000.000</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer con QR */}
                    <div className="w-full bg-white/5 border-t border-white/10 py-6 px-12 flex justify-between items-center">
                        <div className="flex items-center gap-6">
                            <span className="text-slate-400 font-bold uppercase tracking-widest">Sigue participando:</span>
                            <span className="text-2xl font-black text-white tracking-widest">RULETA.LUKEAPP.ME</span>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-3 h-3 rounded-full bg-emerald-500" />
                            <div className="w-3 h-3 rounded-full bg-emerald-500 opacity-50" />
                            <div className="w-3 h-3 rounded-full bg-emerald-500 opacity-20" />
                        </div>
                    </div>
                </div>
            )}

            {/* ZONA DE JUEGO: Ruleta ocupa todo el fondo, Info Card flotante */}
            {!isBillboardScreen && (
                <div className="absolute inset-0 flex items-start justify-center z-10 pt-0">
                    {/* Top Left Container: Info & Queue */}
                    <div className="absolute top-[3vh] left-[3vh] z-40 flex flex-col gap-[1.5vh] items-start max-w-[40%]">
                        {/* 1. Main Info Card */}
                        <div className="bg-white/10 backdrop-blur-md px-[1.5vw] py-[1vh] rounded-[2vh] border border-white/20 flex items-center gap-[1.5vw] shadow-lg">
                            {/* Número Grande Verde Parpadeante */}
                            <div className="flex items-center justify-center bg-black/40 backdrop-blur-md w-[6.5vh] h-[6.5vh] rounded-xl border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.15)] flex-none">
                                <span className="text-[4.5vh] font-black text-green-400 animate-pulse drop-shadow-[0_0_8px_rgba(74,222,128,0.6)] select-none leading-none">
                                    {screen}
                                </span>
                            </div>

                            {/* Player Identity Badge */}
                            {displayNickname && (displayNickname !== 'Jugador' || status !== 'idle' || previewPlayer) && (
                                <div className="border-l border-white/20 pl-[1.5vw] animate-in fade-in slide-in-from-left-4 duration-500">
                                    <p className="text-[1vh] text-gray-400 uppercase tracking-widest leading-none mb-[0.5vh]">
                                        {previewPlayer && status === 'idle' && (!realNickname || realNickname === 'Jugador') ? 'Preparando...' : 'Jugando ahora'}
                                    </p>
                                    <div className="flex items-center gap-[0.5vw]">
                                        {displayEmoji?.startsWith('http') ? (
                                            <img src={displayEmoji} alt="P" className="w-[4.5vh] h-[4.5vh] rounded-full border border-white/20 object-cover shadow-lg" />
                                        ) : (
                                            <span className="text-[2.5vh]">{displayEmoji}</span>
                                        )}
                                        <span className="text-[2.2vh] font-bold text-yellow-400">{displayNickname}</span>
                                    </div>
                                </div>
                            )}

                            {/* Active Selections Visualization */}
                            {currentSelections.length > 0 && (
                                <div className="flex items-center gap-[0.5vw] border-l border-white/20 pl-[1.5vw] animate-in fade-in slide-in-from-right-4 duration-700 delay-200">
                                    <div className="flex -space-x-[1.2vh]">
                                        {currentSelections.map((selId, idx) => {
                                            let imgSrc = null;
                                            if (activeWheelAssets?.segments) {
                                                const seg = activeWheelAssets.segments.find((s: any) => s.id === selId);
                                                if (seg) imgSrc = seg.imageResult || seg.imageWheel;
                                            }
                                            if (!imgSrc) {
                                                const animal = ANIMAL_LIST.find(a => a.id === selId);
                                                if (animal) imgSrc = animal.imageSelector || animal.imageWheel;
                                            }

                                            return (
                                                <div key={idx} className="w-[4.5vh] h-[4.5vh] rounded-full border-2 border-gray-800 bg-gray-700 relative overflow-hidden shadow-lg">
                                                    {imgSrc ? (
                                                        <Image src={imgSrc} alt="Choice" fill className="object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[1.2vh] font-bold text-white">{selId}</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <span className="text-[0.9vh] text-gray-400 font-mono tracking-tighter leading-tight">APUESTA<br />ACTIVA</span>
                                </div>
                            )}
                        </div>

                        {/* 2. Queue List (Stacked Below) */}
                        <QueueList screenId={screenIdNum} assets={activeWheelAssets} />
                    </div>

                    {/* Ruleta Wrapper — código original restaurado */}
                    {(() => {
                        const segmentCount = activeWheelAssets?.segments?.length;
                        const isFanMode = !isGroupEvent && (assetsLoading || (segmentCount ? segmentCount <= 20 : true));

                        return (
                            <div className={`relative w-full transition-all duration-500 flex items-start justify-center
                                ${isFanMode ? 'aspect-[2/1] overflow-hidden' : 'aspect-square items-center'}
                                ${assetsLoading ? 'opacity-0' : 'opacity-100'}
                            `}>
                                {/* Canvas: Always square intrinsic matching width.
                                In Fan Mode, it overflows the container (bottom cropped). */}
                                <div className={`relative w-full aspect-square`}>
                                    <WheelCanvas
                                        isSpinning={storeStatus === 'spinning'}
                                        isIdle={storeStatus === 'idle'}
                                        idleSpeed={idleSpeed || 4.0}
                                        targetIndex={result}
                                        onSpinComplete={handleSpinComplete}
                                        segments={activeWheelAssets?.segments}
                                        className="w-full h-full"
                                    />
                                </div>

                                {!isFanMode && (
                                    <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-0 h-0 border-t-[1.8vh] border-t-transparent border-l-[3.6vh] border-l-red-600 border-b-[1.8vh] border-b-transparent filter drop-shadow-lg z-20"></div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* QR Sidebar (Solo en Modo Individual) */}
            {!isGroupEvent && !isBillboardScreen && (
                <div className={`absolute right-0 top-0 h-full bg-slate-950/90 backdrop-blur-lg border-l border-white/10 p-[3vh] px-[2vw] flex flex-col items-center justify-start text-center transition-all duration-700 ease-in-out z-50 overflow-hidden
                    ${status === 'spinning' 
                        ? 'w-0 min-w-0 max-w-0 opacity-0 border-l-transparent pointer-events-none translate-x-full' 
                        : 'w-[22vw] min-w-[260px] max-w-[340px] opacity-100 translate-x-0'
                    }`}
                >
                    {/* Header Text Group */}
                    <div className="flex flex-col items-center flex-none">
                        <h3 className="text-[3vh] font-black text-white leading-tight mb-[0.5vh] tracking-tight">¡Juega Ahora!</h3>
                        <p className="text-[2vh] text-primary font-extrabold mb-[0.2vh] uppercase tracking-wide">Escanea para unirte</p>
                        <p className="text-[1.5vh] text-gray-400 mb-[2vh]">Solo $1,000 por jugada</p>
                    </div>

                    {/* QR Code */}
                    <div className="bg-white p-[1.5vh] rounded-[2vh] shadow-2xl transform hover:scale-105 transition-all w-[18vh] h-[18vh] max-w-[85%] max-h-[180px] flex items-center justify-center aspect-square flex-none">
                        {clientUrl && (
                            <QRCodeCanvas
                                value={`${(baseUrl || clientUrl).trim()}/individual/screen/${screen}`}
                                size={150}
                                level="H"
                                includeMargin={false}
                                className="w-full h-full rounded-[1vh]"
                            />
                        )}
                    </div>

                    {/* Spacer principal para separar QR de Historial (crece dinámicamente) */}
                    <div className="flex-grow min-h-[3vh]" />

                    {/* History Grid */}
                    <div className="w-full max-w-[220px] flex-none">
                        <h4 className="text-[1.3vh] uppercase tracking-wider text-gray-500 mb-[1.5vh] border-b border-white/10 pb-[0.5vh] leading-none">Últimos 9</h4>
                        <div className="grid grid-cols-3 gap-[0.8vh]">
                            {[...lastSpins, ...Array(9)].slice(0, 9).map((spin, i) => {
                                let imageSrc = null;
                                if (spin && activeWheelAssets?.segments) {
                                    const segment = activeWheelAssets.segments.find((s: any) => s.id === spin.result_index);
                                    if (segment) imageSrc = segment.imageResult || segment.imageWheel;
                                }

                                return (
                                    <div key={i} className="aspect-square bg-white/5 rounded-[0.8vh] border border-white/10 overflow-hidden relative flex items-center justify-center">
                                        {spin ? (
                                            imageSrc ? (
                                                <div className="w-full h-full relative">
                                                    <Image
                                                        src={imageSrc}
                                                        alt="Res"
                                                        fill
                                                        className="object-contain p-[0.3vh]"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="text-[1.8vh] text-yellow-500 font-bold">#{spin.result_index}</span>
                                            )
                                        ) : (
                                            <div className="w-[0.5vh] h-[0.5vh] bg-white/10 rounded-full" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Spacer secundario para separar Historial del Debug Info */}
                    <div className="flex-grow min-h-[2vh]" />

                    {/* Staff Debug Info */}
                    <div className="opacity-30 hover:opacity-100 transition-opacity text-[1.1vh] text-gray-500 text-left w-full pt-[1.5vh] leading-normal flex-none border-t border-white/5">
                        Mode: {venueMode} | Central: {centralScreenId} <br />
                        Evt: {isGroupEvent ? 'Yes' : 'No'} | St: {status}
                    </div>
                </div>
            )}

            {/* --- WINNER REACTIONS --- */}
            <BigWinOverlay
                isVisible={showBigWin}
                resultIndex={result}
                assets={activeWheelAssets}
                playerName={realNickname}
                playerEmoji={realEmoji}
                type={isWin ? 'win' : 'loss'}
            />

            {showConfetti && (
                <div className="absolute inset-0 z-[100] pointer-events-none">
                    <Confetti
                        width={typeof window !== 'undefined' ? window.innerWidth : 1000}
                        height={typeof window !== 'undefined' ? window.innerHeight : 1000}
                        recycle={true}
                        numberOfPieces={500}
                        gravity={0.2}
                    />
                </div>
            )}

            <div className="fixed bottom-0 left-0 bg-red-600 text-white p-2 z-[9999] text-xs font-mono hidden">
                DEBUG: VenueMode={venueMode} | Screen={screen} | Central={centralScreenId}
            </div>

            {/* DEBUG / TIMING PROGRESS BAR */}
            {status === 'result' && (
                <div className="fixed bottom-0 left-0 w-full h-2 bg-gray-800 z-[9999]">
                    <div
                        className="h-full bg-gradient-to-r from-yellow-500 to-red-500 origin-left"
                        style={{
                            animation: `progress-fill ${isDemo ? '5s' : '10s'} linear forwards`
                        }}
                    />

                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes progress-fill {
                    from { width: 0%; }
                    to { width: 100%; }
                }
            `}} />

        </div>
    );
}
