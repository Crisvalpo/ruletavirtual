'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: ('player' | 'staff' | 'admin')[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { user, profile, isLoading } = useAuth();
    const router = useRouter();
    const hasRedirected = useRef(false);

    // Stabilize allowedRoles to prevent unnecessary re-renders
    const rolesKey = useMemo(() => allowedRoles.join(','), [allowedRoles.join(',')]);

    useEffect(() => {
        if (!isLoading && !hasRedirected.current) {
            if (!user) {
                // No autenticado -> Enviar a Home (o login si fuera necesario)
                hasRedirected.current = true;
                router.push('/');
            } else if (profile && !allowedRoles.includes(profile.role)) {
                // Autenticado pero sin el rol correcto
                hasRedirected.current = true;
                router.push('/not-authorized');
            }
        }
    }, [user, profile, isLoading, rolesKey, router, allowedRoles]);

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
