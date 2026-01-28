'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: ('player' | 'staff' | 'admin')[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { user, profile, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                // No autenticado -> Enviar a Home (o login si fuera necesario)
                router.push('/');
            } else if (profile && !allowedRoles.includes(profile.role)) {
                // Autenticado pero sin el rol correcto
                router.push('/not-authorized');
            }
        }
    }, [user, profile, isLoading, allowedRoles, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            </div>
        );
    }

    // Solo renderizar si el rol es válido
    if (user && profile && allowedRoles.includes(profile.role)) {
        return <>{children}</>;
    }

    return null;
}
