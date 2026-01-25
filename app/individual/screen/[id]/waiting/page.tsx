'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';

export default function WaitingPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params);
    const router = useRouter();

    // Simulación de cola (esto iría con Realtime en prod)
    useEffect(() => {
        const timer = setTimeout(() => {
            router.push(`/individual/screen/${id}/spin`);
        }, 5000); // 5 segundos de espera simulada

        return () => clearTimeout(timer);
    }, [id, router]);

    return (
        <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-8 text-white text-center">
            <div className="animate-pulse mb-8 text-6xl">
                ⏳
            </div>

            <h1 className="text-3xl font-bold mb-4">¡Estás en la cola!</h1>
            <p className="text-xl opacity-90 mb-8">
                Espera tu turno en la pantalla #{id}
            </p>

            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 w-full max-w-sm">
                <p className="text-sm uppercase tracking-wider mb-2">Tu posición</p>
                <p className="text-5xl font-mono font-bold">03</p>
                <p className="text-xs mt-2 opacity-75">Aprox. 2 minutos de espera</p>
            </div>
        </div>
    );
}
