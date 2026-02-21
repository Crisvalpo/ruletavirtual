'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const { signInWithGoogle, signInWithEmail, user, isLoading } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [isEmailSent, setIsEmailSent] = useState(false);

    // Redirect if already logged in
    React.useEffect(() => {
        if (user && !isLoading) {
            const returnUrl = localStorage.getItem('auth_return_url') || '/';
            router.push(returnUrl);
        }
    }, [user, isLoading, router]);

    const handleGoogleLogin = async () => {
        await signInWithGoogle();
    };

    const handleMagicLink = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!email) return;

        const { error } = await signInWithEmail(email);
        if (!error) {
            setIsEmailSent(true);
        } else {
            alert('Error al enviar el enlace: ' + error.message);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] relative overflow-hidden p-6">
            {/* Background elements for "wow" factor */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />

            <div className="w-full max-w-md z-10">
                <div className="text-center mb-10">
                    <div className="inline-block p-4 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 mb-6 shadow-2xl">
                        <span className="text-5xl">🎰</span>
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tighter mb-2">
                        Bienvenido a la Ruleta
                    </h1>
                    <p className="text-gray-400 font-medium">
                        Regístrate para guardar tus premios y participar en los sorteos.
                    </p>
                </div>

                <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
                    <button
                        onClick={handleGoogleLogin}
                        className="w-full bg-white text-black font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-200 transition-all active:scale-[0.98] shadow-xl group mb-8"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" className="w-6 h-6">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span>Continuar con Google</span>
                    </button>

                    <div className="relative flex items-center justify-center mb-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10"></div>
                        </div>
                        <span className="relative px-4 bg-transparent text-[10px] uppercase tracking-[0.3em] font-bold text-gray-500 backdrop-blur-md">
                            o con email
                        </span>
                    </div>

                    <div className="space-y-4">
                        <input
                            type="email"
                            placeholder="tu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                        />
                        <button
                            onClick={() => handleMagicLink()}
                            disabled={!email || isEmailSent}
                            className={`w-full py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-lg ${email
                                ? 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-[0.98]'
                                : 'bg-white/5 text-gray-600 cursor-not-allowed'
                                }`}
                        >
                            {isEmailSent ? '✅ Enlace Enviado' : 'Enviar Enlace Mágico'}
                        </button>
                    </div>

                    <p className="mt-8 text-center text-[10px] text-gray-500 font-medium leading-relaxed">
                        Al continuar, aceptas que guardemos tu progreso asociado a tu cuenta.<br />
                        No enviamos spam ni compartimos tus datos.
                    </p>
                </div>
            </div>

            <div className="mt-12 text-white/20 text-[10px] uppercase font-bold tracking-[0.2em] z-10">
                Fiestas Patrias 2026 • Acceso Seguro
            </div>
        </main>
    );
}
