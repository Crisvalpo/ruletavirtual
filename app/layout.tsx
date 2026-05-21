import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Ruleta Animalitos - Fiestas Patrias 2026',
    description: 'Sistema multi-pantalla de ruleta con modo individual, grupal y sorteos especiales',
    manifest: '/manifest.json',
    themeColor: '#0a0a0a',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'Ruleta'
    },
    icons: {
        icon: '/icons/icon-192x192.png',
        apple: '/icons/icon-180x180.png'
    },
    viewport: {
        width: 'device-width',
        initialScale: 1,
        maximumScale: 1,
        userScalable: false,
        viewportFit: 'cover'
    }
};

import { AuthProvider } from '@/hooks/useAuth';

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es" suppressHydrationWarning>
            <body>
                <AuthProvider>
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}
