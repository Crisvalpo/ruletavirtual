'use client';

import Link from 'next/link';

export default function NotAuthorizedPage() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4 text-white">
            <div className="text-center max-w-md">
                <div className="text-8xl mb-6">🚫</div>
                <h1 className="text-4xl font-black mb-4 tracking-tight">Acceso Restringido</h1>
                <p className="text-gray-400 mb-8 leading-relaxed">
                    No tienes los permisos necesarios para acceder a esta sección.
                    Si crees que esto es un error, contacta con el administrador.
                </p>
                <Link
                    href="/"
                    className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-xl transition-all active:scale-95"
                >
                    Volver al Inicio
                </Link>
            </div>
        </main>
    );
}
