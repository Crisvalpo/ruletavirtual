'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallback() {
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const handleAuthCallback = async () => {
            const { error } = await supabase.auth.getSession();
            if (!error) {
                // Redirect to safe place (home or wherever they were)
                // For now, back to home. We could use state to remember the path.
                router.push('/');
            } else {
                console.error('Auth callback error:', error);
                router.push('/');
            }
        };

        handleAuthCallback();
    }, [router, supabase]);

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-center animate-pulse">
                <div className="text-4xl mb-4">🔐</div>
                <p className="text-white font-bold uppercase tracking-widest text-xs">Verificando sesión...</p>
            </div>
        </div>
    );
}
