import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Ruleta Animalitos - Fiestas Patrias 2026',
    description: 'Sistema multi-pantalla de ruleta con modo individual, grupal y sorteos especiales'
};

import { AuthProvider } from '@/hooks/useAuth';

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es">
            <body>
                <AuthProvider>
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}
