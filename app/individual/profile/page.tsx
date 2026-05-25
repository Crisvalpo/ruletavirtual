'use client';

import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import IdentityBadge from '@/components/individual/IdentityBadge';
import { QRCodeCanvas } from 'qrcode.react';

interface PrizeHistory {
    id: string;
    screen_number: number;
    player_name: string;
    player_emoji: string;
    prize_won: string;
    prize_payout_status: 'pending' | 'paid' | 'not_applicable';
    created_at: string;
    package_code?: string;
}

interface GamePackage {
    id: string;
    code: string;
    package_type: string;
    total_plays: number;
    plays_used: number;
    plays_remaining: number;
    is_active: boolean;
    valid_until: string;
    created_at: string;
}

interface RaffleTicket {
    id: string;
    ticket_number: number;
    amount_paid: number;
    payment_method: string;
    prize_claimed: boolean;
    created_at: string;
    raffles: {
        name: string;
        status: string;
        winning_number: number | null;
    } | null;
}

export default function ProfileDashboardPage() {
    const { user, profile, isLoading, refreshProfile } = useAuth();
    const router = useRouter();
    const supabase = createClient();

    // Tabs state
    const [activeTab, setActiveTab] = useState<'profile' | 'prizes' | 'tickets'>('profile');

    // Profile form state
    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Camera selfie state
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // History data state
    const [prizes, setPrizes] = useState<PrizeHistory[]>([]);
    const [packages, setPackages] = useState<GamePackage[]>([]);
    const [raffleTickets, setRaffleTickets] = useState<RaffleTicket[]>([]);
    const [isFetchingData, setIsFetchingData] = useState(true);

    // Interactive Prize QR Modal state
    const [activePrizeForQr, setActivePrizeForQr] = useState<PrizeHistory | null>(null);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/');
            return;
        }

        if (user) {
            setDisplayName(profile?.display_name || '');
            setAvatarUrl(profile?.avatar_url || '');
            fetchHistoryData();
        }
    }, [user, isLoading, profile]);

    const fetchHistoryData = async () => {
        if (!user) return;
        setIsFetchingData(true);
        try {
            // 1. Fetch prizes won
            const { data: prizeData } = await supabase
                .from('player_queue')
                .select('id, screen_number, player_name, player_emoji, prize_won, prize_payout_status, created_at, package_code')
                .eq('player_id', user.id)
                .neq('prize_won', null)
                .neq('prize_won', '')
                .order('created_at', { ascending: false });

            if (prizeData) setPrizes(prizeData as any);

            // 2. Fetch game packages (combos) by package codes used by player
            const { data: queueItems } = await supabase
                .from('player_queue')
                .select('package_code')
                .eq('player_id', user.id);

            const codes = Array.from(new Set(
                (queueItems || []).map(q => q.package_code).filter(Boolean)
            ));

            if (codes.length > 0) {
                const { data: pkgData } = await supabase
                    .from('game_packages')
                    .select('*')
                    .in('code', codes)
                    .order('created_at', { ascending: false });
                if (pkgData) setPackages(pkgData as any);
            }

            // 3. Fetch raffle tickets
            const { data: raffleData } = await supabase
                .from('raffle_tickets')
                .select(`
                    id,
                    ticket_number,
                    amount_paid,
                    payment_method,
                    prize_claimed,
                    created_at,
                    raffles:raffle_id (
                        name,
                        status,
                        winning_number
                    )
                `)
                .eq('player_id', user.id)
                .order('created_at', { ascending: false });

            if (raffleData) setRaffleTickets(raffleData as any);

        } catch (e) {
            console.error('Error fetching dashboard data:', e);
        } finally {
            setIsFetchingData(false);
        }
    };

    // Save profile display name
    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSavingProfile(true);
        setSaveMessage(null);

        const trimmedName = displayName.trim();

        const { error } = await supabase
            .from('profiles')
            .update({
                display_name: trimmedName,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        setIsSavingProfile(false);
        if (error) {
            setSaveMessage({ text: 'Error al guardar los cambios: ' + error.message, type: 'error' });
        } else {
            setSaveMessage({ text: '¡Perfil actualizado con éxito! ✨', type: 'success' });
            setTimeout(() => setSaveMessage(null), 3000);
            refreshProfile();
        }
    };

    // Handle File Pick Upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setIsSavingProfile(true);
        setSaveMessage(null);

        try {
            // Upload to Supabase Storage
            const fileExt = file.name.split('.').pop() || 'jpg';
            const fileName = `avatar.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

            // Update Profiles table
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: cacheBustedUrl })
                .eq('id', user.id);

            if (updateError) throw updateError;

            setAvatarUrl(cacheBustedUrl);
            setSaveMessage({ text: 'Imagen de perfil cargada con éxito 📸', type: 'success' });
            setTimeout(() => setSaveMessage(null), 3000);
            refreshProfile();
        } catch (error: any) {
            setSaveMessage({ text: 'Error al subir imagen: ' + error.message, type: 'error' });
        } finally {
            setIsSavingProfile(false);
        }
    };

    // Camera controllers
    const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
        setIsCameraActive(true);
        setCameraError(null);
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: mode, width: { ideal: 480 }, height: { ideal: 480 } }
            });
            setCameraStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err: any) {
            console.error('Error accessing camera:', err);
            setCameraError('No pudimos acceder a tu cámara. Asegúrate de dar los permisos correspondientes.');
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setIsCameraActive(false);
        setCameraError(null);
    };

    const toggleCameraDirection = async () => {
        const newMode = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(newMode);
        if (isCameraActive) {
            await startCamera(newMode);
        }
    };

    const captureSelfie = () => {
        if (!videoRef.current || !user) return;

        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        // Capture a square photo
        const size = Math.min(video.videoWidth, video.videoHeight);
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw cropped square center
        const sx = (video.videoWidth - size) / 2;
        const sy = (video.videoHeight - size) / 2;
        ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

        canvas.toBlob(async (blob) => {
            if (!blob) return;

            setIsSavingProfile(true);
            stopCamera();

            try {
                const filePath = `${user.id}/avatar.jpg`;
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, blob, { upsert: true, contentType: 'image/jpeg' });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ avatar_url: cacheBustedUrl })
                    .eq('id', user.id);

                if (updateError) throw updateError;

                setAvatarUrl(cacheBustedUrl);
                setSaveMessage({ text: 'Selfie guardada como imagen de perfil 🤳', type: 'success' });
                setTimeout(() => setSaveMessage(null), 3000);
                refreshProfile();
            } catch (err: any) {
                setSaveMessage({ text: 'Error al guardar selfie: ' + err.message, type: 'error' });
            } finally {
                setIsSavingProfile(false);
            }
        }, 'image/jpeg', 0.85);
    };

    if (isLoading || (isFetchingData && activeTab !== 'profile')) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-8">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#050505] text-white flex flex-col pwa-mode">
            {/* Header Sticky */}
            <div className="bg-[#111] border-b border-white/5 px-4 py-3 flex justify-between items-center z-20 sticky top-0 backdrop-blur-md">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-white/5 rounded-xl transition-all"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-lg font-black uppercase tracking-tighter italic">Panel de Perfil ⚙️</h1>
                <IdentityBadge />
            </div>

            <div className="flex-1 p-6 max-w-2xl mx-auto w-full pb-20">
                {/* Tabs bar */}
                <div className="flex bg-[#111] border border-white/5 p-1 rounded-2xl mb-8">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${activeTab === 'profile' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Perfil
                    </button>
                    <button
                        onClick={() => setActiveTab('prizes')}
                        className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${activeTab === 'prizes' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Victorias ({prizes.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('tickets')}
                        className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${activeTab === 'tickets' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Tickets ({packages.length + raffleTickets.length})
                    </button>
                </div>

                {/* Save Feedback Alerts */}
                {saveMessage && (
                    <div className={`mb-6 p-4 rounded-2xl border text-sm font-bold animate-zoom-in text-center ${saveMessage.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-red-500/10 border-red-500/30 text-red-500'
                        }`}>
                        {saveMessage.text}
                    </div>
                )}

                {/* --- TAB CONTENT: PROFILE --- */}
                {activeTab === 'profile' && (
                    <div className="space-y-6">
                        {/* Statistics Grid */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-[#111] border border-white/5 rounded-2xl p-4 text-center shadow-xl relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <span className="text-2xl block mb-1">🎮</span>
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Giros</span>
                                <span className="text-2xl font-black text-white">{profile?.total_plays || 0}</span>
                            </div>
                            <div className="bg-[#111] border border-white/5 rounded-2xl p-4 text-center shadow-xl relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <span className="text-2xl block mb-1">🏆</span>
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Victorias</span>
                                <span className="text-2xl font-black text-yellow-500">{profile?.total_wins || 0}</span>
                            </div>
                            <div className="bg-[#111] border border-white/5 rounded-2xl p-4 text-center shadow-xl relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <span className="text-2xl block mb-1">📈</span>
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Éxito</span>
                                <span className="text-2xl font-black text-secondary">
                                    {profile?.total_plays ? Math.round(((profile.total_wins || 0) / profile.total_plays) * 100) : 0}%
                                </span>
                            </div>
                        </div>

                        {/* Account Email Card */}
                        <div className="bg-[#111] border border-white/5 rounded-2xl p-4 flex items-center justify-between text-xs shadow-md">
                            <div>
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Cuenta Vinculada</p>
                                <p className="font-mono text-gray-300 font-bold">{profile?.email || user?.email || 'No disponible'}</p>
                            </div>
                            <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-1 rounded-full font-black uppercase tracking-widest text-[8px] leading-none">
                                Activo
                            </span>
                        </div>

                        <div className="bg-[#111] border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col items-center">
                            {/* Avatar section */}
                            <div className="relative group mb-6">
                                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary shadow-2xl relative bg-[#222]">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-5xl">
                                            😎
                                        </div>
                                    )}
                                </div>
                                <div className="absolute -bottom-1 -right-1 flex gap-1">
                                    <label className="bg-primary hover:bg-primary-dark p-2.5 rounded-full cursor-pointer border-2 border-[#111] shadow-lg transition-all flex items-center justify-center" title="Subir Imagen">
                                        <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                        </svg>
                                    </label>
                                    <button
                                        onClick={() => startCamera(facingMode)}
                                        className="bg-secondary hover:bg-secondary-dark p-2.5 rounded-full border-2 border-[#111] shadow-lg transition-all flex items-center justify-center"
                                        title="Tomar Selfie"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-8">
                                Personaliza cómo te verás en pantalla
                            </p>

                            <form onSubmit={handleSaveProfile} className="w-full space-y-5">
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-2">Apodo / Nombre</label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        maxLength={15}
                                        className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 focus:border-primary focus:outline-none text-base font-bold text-center animate-transition"
                                        placeholder="Tu nombre en el juego"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSavingProfile || !displayName.trim()}
                                    className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all text-white ${isSavingProfile || !displayName.trim()
                                        ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                                        : 'bg-primary hover:bg-primary-dark shadow-lg shadow-primary/20 active:scale-95'
                                        }`}
                                >
                                    {isSavingProfile ? 'Guardando...' : 'Guardar Perfil'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* --- TAB CONTENT: PRIZES (VICTORIAS) --- */}
                {activeTab === 'prizes' && (
                    <div className="space-y-4">
                        {prizes.length === 0 ? (
                            <div className="text-center py-20 bg-[#111] border border-white/5 rounded-3xl opacity-30">
                                <div className="text-6xl mb-6">🏆</div>
                                <p className="text-sm font-black uppercase tracking-[0.2em]">¡Vitrina vacía!</p>
                                <p className="text-[10px] mt-2 italic">Gira la ruleta y reclama tu victoria</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {prizes.map((prize) => (
                                    <div
                                        key={prize.id}
                                        onClick={() => setActivePrizeForQr(prize)}
                                        className="bg-[#111] border border-white/5 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden group hover:border-primary/30 transition-all shadow-xl cursor-pointer active:scale-[0.99]"
                                    >
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${prize.prize_payout_status === 'paid' ? 'bg-green-500' : 'bg-yellow-500'}`} />

                                        <div className="text-3xl bg-white/5 w-12 h-12 flex items-center justify-center rounded-xl border border-white/10 group-hover:scale-105 transition-all">
                                            {prize.player_emoji}
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">
                                                    {new Date(prize.created_at).toLocaleDateString()}
                                                </p>
                                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${prize.prize_payout_status === 'paid'
                                                    ? 'bg-green-500/10 text-green-500'
                                                    : 'bg-yellow-500/10 text-yellow-500'
                                                    }`}>
                                                    {prize.prize_payout_status === 'paid' ? 'Cobrado' : 'Por Reclamar'}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-black tracking-tight text-white mb-0.5">
                                                {prize.prize_won}
                                            </h3>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                                                Pantalla #{prize.screen_number}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-center">
                                            <span className="bg-white/5 group-hover:bg-primary/20 group-hover:text-white text-white/40 text-[9px] font-black uppercase tracking-widest px-2.5 py-2 rounded-xl transition-all border border-white/5 group-hover:border-primary/20">
                                                VER QR 🎫
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* --- TAB CONTENT: TICKETS --- */}
                {activeTab === 'tickets' && (
                    <div className="space-y-8 animate-zoom-in">
                        {/* Seccion 1: Tickets de Giros (Game Packages) */}
                        <div className="space-y-4">
                            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 px-1">
                                Paquetes de Giros 🎮
                            </h2>
                            {packages.length === 0 ? (
                                <div className="text-center py-8 bg-[#111]/40 border border-white/5 rounded-3xl opacity-30">
                                    <p className="text-[10px] uppercase font-bold tracking-wider">No has usado paquetes de giros</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {packages.map((pkg) => {
                                        const remaining = pkg.total_plays - (pkg.plays_used || 0);
                                        return (
                                            <div
                                                key={pkg.id}
                                                onClick={() => router.push(`/ticket/view/${pkg.code}`)}
                                                className="bg-[#111] border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:border-primary/20 transition-all cursor-pointer shadow-md"
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-mono text-sm font-black text-white">{pkg.code}</span>
                                                        <span className="text-[9px] font-black uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                                            {pkg.package_type}
                                                        </span>
                                                    </div>
                                                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                                                        Vence: {new Date(pkg.valid_until).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xl font-black text-white leading-none mb-0.5">
                                                        {remaining} <span className="text-[10px] font-bold text-gray-500 uppercase">giros</span>
                                                    </p>
                                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">
                                                        Usados: {pkg.plays_used}/{pkg.total_plays}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Seccion 2: Boletos de Sorteos (Raffle Tickets) */}
                        <div className="space-y-4">
                            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 px-1">
                                Boletos de Sorteos 🎟️
                            </h2>
                            {raffleTickets.length === 0 ? (
                                <div className="text-center py-8 bg-[#111]/40 border border-white/5 rounded-3xl opacity-30">
                                    <p className="text-[10px] uppercase font-bold tracking-wider">No tienes boletos de sorteos</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {raffleTickets.map((t) => {
                                        const isWinner = t.raffles?.winning_number !== null && t.raffles?.winning_number === t.ticket_number;
                                        return (
                                            <div
                                                key={t.id}
                                                className={`bg-[#111] border rounded-2xl p-4 flex items-center justify-between shadow-md transition-all ${isWinner
                                                    ? 'border-yellow-500/40 bg-yellow-500/5'
                                                    : 'border-white/5'
                                                    }`}
                                            >
                                                <div>
                                                    <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1">
                                                        {t.raffles?.name || 'Sorteo General'}
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg font-black text-white italic tracking-tighter">
                                                            N° {String(t.ticket_number).padStart(4, '0')}
                                                        </span>
                                                        {isWinner && (
                                                            <span className="text-[8px] font-black uppercase bg-yellow-500 text-black px-2 py-0.5 rounded-full animate-pulse">
                                                                ¡Ganador! 👑
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                                                        {new Date(t.created_at).toLocaleDateString()} · {t.payment_method}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    {isWinner ? (
                                                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${t.prize_claimed
                                                            ? 'bg-green-500/10 text-green-500'
                                                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20'
                                                            }`}>
                                                            {t.prize_claimed ? 'Cobrado' : 'Por Reclamar'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] font-black text-gray-500 uppercase bg-white/5 px-2.5 py-1 rounded-full">
                                                            {t.raffles?.status === 'active' ? 'Pendiente' : 'Finalizado'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* INTERACTIVE PRIZE QR CODE MODAL */}
            {activePrizeForQr && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6 animate-zoom-in backdrop-blur-sm"
                    onClick={() => setActivePrizeForQr(null)}
                >
                    <div
                        className="bg-[#111] border border-white/10 rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setActivePrizeForQr(null)}
                            className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full transition-all text-gray-400 hover:text-white"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="text-5xl mb-3 mt-2">{activePrizeForQr.player_emoji}</div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight mb-1">
                            {activePrizeForQr.prize_won}
                        </h2>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-6">
                            Pantalla #{activePrizeForQr.screen_number} · {new Date(activePrizeForQr.created_at).toLocaleDateString()}
                        </p>

                        {/* QR Code Container */}
                        <div className="bg-white p-4 rounded-3xl inline-block shadow-2xl mb-6">
                            <QRCodeCanvas
                                value={`${window.location.origin}/staff/validate/${activePrizeForQr.package_code || activePrizeForQr.id}`}
                                size={180}
                                level="H"
                                includeMargin={false}
                                className="rounded-lg"
                            />
                            <p className="mt-2 text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none">QR VÁLIDO EN MESÓN</p>
                        </div>

                        {/* ID de Transaccion */}
                        <div className="bg-white/5 border border-white/10 rounded-xl py-2 px-3 mb-6 inline-flex flex-col items-center max-w-full">
                            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-0.5">ID de Transacción</span>
                            <span className="font-mono text-[9px] font-bold text-white truncate max-w-xs">{activePrizeForQr.id}</span>
                        </div>

                        <div className="space-y-3">
                            <div className={`p-3 rounded-xl border text-xs font-black uppercase tracking-wider ${activePrizeForQr.prize_payout_status === 'paid'
                                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 animate-pulse'
                                }`}>
                                Estado: {activePrizeForQr.prize_payout_status === 'paid' ? 'Cobrado ✅' : 'Pendiente de Cobro ⚠️'}
                            </div>
                            <p className="text-[10px] text-gray-500 leading-tight">
                                Presenta este código QR al personal en el mesón para reclamar tu premio.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* LIVE CAMERA MODAL/OVERLAY */}
            {isCameraActive && (
                <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-6 animate-zoom-in">
                    <div className="relative w-full max-w-sm flex flex-col items-center">
                        <h2 className="text-lg font-black uppercase tracking-widest text-center text-white mb-6">
                            Toma una Foto 🤳
                        </h2>

                        {/* Camera viewport frame */}
                        <div className="relative w-72 h-72 rounded-full overflow-hidden border-4 border-primary bg-[#111] mb-8 shadow-2xl flex items-center justify-center">
                            {cameraError ? (
                                <p className="text-xs text-red-500 text-center font-bold px-4">{cameraError}</p>
                            ) : (
                                <>
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                                    />
                                    {/* Neon Scanning ring overlay */}
                                    <div className="absolute inset-2 border-2 border-dashed border-secondary/40 rounded-full animate-spin pointer-events-none" style={{ animationDuration: '20s' }} />

                                    {/* Camera switch floating button */}
                                    <button
                                        onClick={toggleCameraDirection}
                                        className="absolute bottom-2 right-2 bg-secondary hover:bg-secondary-dark p-3 rounded-full border-2 border-[#111] shadow-lg transition-all active:scale-95 z-10"
                                        title="Cambiar Cámara"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                        </svg>
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-4 w-full">
                            <button
                                onClick={stopCamera}
                                className="flex-1 py-4 bg-white/5 border border-white/10 text-white font-bold text-xs uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            {!cameraError && (
                                <button
                                    onClick={captureSelfie}
                                    className="flex-1 py-4 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-primary-dark transition-all active:scale-95 shadow-lg shadow-primary/25"
                                >
                                    Tomar Foto
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="p-8 text-center opacity-25 mt-auto">
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Antigravity Rewards · Panel de Jugador</p>
            </div>
        </main>
    );
}
