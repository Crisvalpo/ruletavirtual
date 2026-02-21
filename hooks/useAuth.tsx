'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface Profile {
    id: string;
    display_name: string;
    avatar_url: string;
    role: 'player' | 'staff' | 'admin';
    cooldown_until: string | null;
}

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    session: Session | null;
    isLoading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string) => Promise<{ error: any }>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const supabase = createClient();
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchProfile = async (userId: string, mounted = true) => {
        try {
            const { data: profileData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                if (error.message?.includes('aborted')) return;

                // SELF-HEALING: If profile is missing (PGRST116), create it
                if (error.code === 'PGRST116') {
                    console.log('Perfil no encontrado. Auto-generando...');
                    const { data: { user: currentUser } } = await supabase.auth.getUser();

                    if (currentUser) {
                        const { error: insertError } = await supabase
                            .from('profiles')
                            .insert({
                                id: currentUser.id,
                                email: currentUser.email,
                                display_name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || 'Jugador',
                                avatar_url: currentUser.user_metadata?.avatar_url,
                                role: currentUser.email === 'cristianluke@gmail.com' ? 'admin' : 'player'
                            });

                        if (!insertError) {
                            // Retry fetch
                            return fetchProfile(userId, mounted);
                        } else {
                            console.error('Error al auto-generar perfil:', insertError);
                        }
                    }
                }

                console.error('Error fetching profile:', error);
                return;
            }

            if (profileData && mounted) {
                // FORCE ADMIN for specific user
                if (user?.email === 'cristianluke@gmail.com') {
                    profileData.role = 'admin';
                }
                setProfile(profileData);
            }
        } catch (err: any) {
            if (err.name === 'AbortError' || err.message?.includes('aborted')) return;
            console.error('Profile fetch failed:', err);
        }
    };

    useEffect(() => {
        let isMounted = true;
        let authSubscription: { unsubscribe: () => void } | null = null;

        const initializeAuth = async () => {
            try {
                setIsLoading(true);

                // 1. Get current session
                const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError && !sessionError.message?.includes('aborted')) {
                    console.error('Session fetch error:', sessionError);
                }

                if (!isMounted) return;

                // 2. If no session, just stop loading
                if (!currentSession) {
                    setIsLoading(false);
                }

                // 3. Listen for changes
                const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
                    if (!isMounted) return;

                    setSession(newSession);
                    setUser(newSession?.user ?? null);

                    if (newSession?.user) {
                        await fetchProfile(newSession.user.id, isMounted);
                    } else {
                        setProfile(null);
                    }
                    setIsLoading(false);
                });

                if (!isMounted) {
                    subscription.unsubscribe();
                } else {
                    authSubscription = subscription;
                }

            } catch (err: any) {
                if (err.name !== 'AbortError' && !err.message?.includes('aborted')) {
                    console.error('Auth initialization failed:', err);
                }
            }
        };

        initializeAuth();
        return () => {
            isMounted = false;
            if (authSubscription) authSubscription.unsubscribe();
        };
    }, []);

    // Realtime subscription for profile changes
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel(`profile_sync_${user.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
                (payload) => {
                    setProfile(payload.new as Profile);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user?.id]);

    const signInWithGoogle = async () => {
        const origin = window.location.origin;
        const currentPath = window.location.pathname + window.location.search;

        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(currentPath)}`,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent'
                }
            }
        });
    };

    const signInWithEmail = async (email: string) => {
        const origin = window.location.origin;
        const currentPath = window.location.pathname + window.location.search;

        return await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(currentPath)}`,
            }
        });
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const refreshProfile = async () => {
        if (user) await fetchProfile(user.id);
    };

    return (
        <AuthContext.Provider value={{ user, profile, session, isLoading, signInWithGoogle, signInWithEmail, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
